import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminOrOwner, isLoanOfficer } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  isMissingDatabaseObjectError,
} from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const purposeSchema = z.enum([
  "purchase",
  "rate_term_refinance",
  "cash_out_refinance",
  "heloc",
  "construction",
  "other",
]);

const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);

const rowSchema = z.object({
  borrower_name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(240).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  property_address: z.string().trim().max(240).optional().or(z.literal("")),
  loan_program: z.string().trim().max(120).optional().or(z.literal("")),
  loan_purpose: purposeSchema.default("other"),
  loan_number: z.string().trim().max(80).optional().or(z.literal("")),
  priority: prioritySchema.default("normal"),
  notes: z.string().trim().max(1200).optional().or(z.literal("")),
  next_action: z.string().trim().max(240).optional().or(z.literal("")),
});

const schema = z.object({
  rows: z.array(rowSchema).min(1).max(50),
});

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isAdminOrOwner(profile) && !isLoanOfficer(profile)) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Loan intake is for LOs and admins." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const createdLoanIds: string[] = [];

  try {
    for (const row of parsed.data.rows) {
      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          owner_id: profile.id,
          loan_number: blankToNull(row.loan_number),
          loan_program: blankToNull(row.loan_program),
          loan_purpose: row.loan_purpose,
          property_address: blankToNull(row.property_address),
          stage: "lead",
          stage_status: "working",
          priority: row.priority,
          notes: blankToNull(row.notes ?? row.next_action),
          is_sample: false,
        })
        .select("id")
        .single();

      if (loanError || !loan) {
        return NextResponse.json(
          {
            ok: false,
            error: "loan_insert_failed",
            message: loanError?.message ?? "Could not create loan draft.",
          },
          { status: 500 }
        );
      }

      createdLoanIds.push(loan.id as string);

      const { error: borrowerError } = await supabase.from("borrowers").insert({
        loan_id: loan.id,
        owner_id: profile.id,
        full_name: row.borrower_name,
        email: blankToNull(row.email),
        phone: blankToNull(row.phone),
        is_primary: true,
        is_sample: false,
      });

      if (borrowerError) {
        return NextResponse.json(
          {
            ok: false,
            error: "borrower_insert_failed",
            message: borrowerError.message,
          },
          { status: 500 }
        );
      }

      if (row.next_action?.trim()) {
        const { error: taskError } = await supabase.from("loan_tasks").insert({
          loan_id: loan.id,
          owner_id: profile.id,
          title: row.next_action.trim(),
          detail: "Created from My Loans local intake.",
          assignee_role: "loan_officer",
          assignee_id: profile.id,
          status: "todo",
          priority: row.priority,
          is_sample: false,
        });
        if (taskError && !isMissingDatabaseObjectError(taskError)) {
          console.warn("loan intake task insert failed", taskError.message);
        }
      }
    }
  } catch (err) {
    if (isMissingDatabaseObjectError(err)) {
      return NextResponse.json(
        {
          ok: false,
          error: "loan_tables_missing",
          message:
            "Mortgage intake tables are not provisioned yet. Apply the mortgage data migrations before importing loans.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: err instanceof Error ? err.message : "Loan intake failed.",
      },
      { status: 500 }
    );
  }

  await recordAudit({
    actor: profile,
    action: "loan_intake_created",
    target_type: "loans",
    target_id: createdLoanIds[0] ?? null,
    metadata: {
      count: createdLoanIds.length,
      loan_ids: createdLoanIds,
      source: "my_loans_local_intake",
    },
  });

  return NextResponse.json({
    ok: true,
    created: createdLoanIds.length,
    loan_ids: createdLoanIds,
  });
}
