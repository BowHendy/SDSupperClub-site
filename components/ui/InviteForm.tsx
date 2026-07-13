"use client";

import { useForm } from "react-hook-form";
import { type BaseSyntheticEvent, useState } from "react";
import { Button } from "./Button";
import { birthYearOptions, isAtLeast21 } from "@/lib/age";

type InviteFormData = {
  name: string;
  email: string;
  birthYear: string;
  referredBy: string;
  why: string;
};

const BIRTH_YEARS = birthYearOptions();
const UNDER_21_MESSAGE =
  "Supper Collective is not available to those under 21.";

export function InviteForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorReason, setErrorReason] = useState<"submit_failed" | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>({
    defaultValues: { birthYear: "" },
  });

  const birthYearValue = watch("birthYear");
  const birthYearNum = birthYearValue ? parseInt(birthYearValue, 10) : NaN;
  const hasBirthYear = birthYearValue !== "" && !Number.isNaN(birthYearNum);
  const isOver21 = hasBirthYear && isAtLeast21(birthYearNum);
  const isUnder21 = hasBirthYear && !isAtLeast21(birthYearNum);

  const onSubmit = async (_data: InviteFormData, e?: BaseSyntheticEvent) => {
    if (!isOver21) return;
    setErrorReason(null);
    setStatus("sending");
    try {
      const formEl = e?.target as HTMLFormElement | undefined;
      const formData = new FormData(formEl);
      formData.set("form-name", "invite-request");
      const encoded = new URLSearchParams();
      formData.forEach((value, key) => {
        encoded.append(key, typeof value === "string" ? value : String(value));
      });
      const res = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encoded.toString(),
      });
      if (res.ok) {
        setStatus("success");
        reset();
      } else {
        setErrorReason("submit_failed");
        setStatus("error");
      }
    } catch {
      setErrorReason("submit_failed");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <p className="font-geist text-body-lg text-foreground/90">
        Thank you. We&apos;ll review your request and be in touch.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      name="invite-request"
      method="POST"
      data-netlify="true"
      netlify-honeypot="bot-field"
      className="mx-auto max-w-xl space-y-6"
    >
      <input type="hidden" name="form-name" value="invite-request" />
      <p className="hidden" aria-hidden="true">
        <input name="bot-field" tabIndex={-1} autoComplete="off" />
      </p>
      <div>
        <label htmlFor="name" className="mb-1 block font-geist text-body-sm text-foreground/80">
          Name
        </label>
        <input
          id="name"
          type="text"
          {...register("name", { required: "Name is required" })}
          className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none"
          placeholder="Your name"
        />
        {errors.name && (
          <p className="mt-1 text-body-sm text-terracotta">{errors.name.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block font-geist text-body-sm text-foreground/80">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register("email", { required: "Email is required" })}
          className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none"
          placeholder="you@example.com"
        />
        {errors.email && (
          <p className="mt-1 text-body-sm text-terracotta">{errors.email.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="birthYear" className="mb-1 block font-geist text-body-sm text-foreground/80">
          Birth year
        </label>
        <select
          id="birthYear"
          {...register("birthYear", { required: "Birth year is required" })}
          className="w-full rounded border border-white/20 bg-charcoal px-4 py-3 font-geist text-foreground focus:border-brass focus:outline-none"
          defaultValue=""
        >
          <option value="" disabled>
            Select year
          </option>
          {BIRTH_YEARS.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>
        {errors.birthYear && (
          <p className="mt-1 text-body-sm text-terracotta">{errors.birthYear.message}</p>
        )}
        {isUnder21 && (
          <p className="mt-2 text-body-sm text-terracotta" role="alert">
            {UNDER_21_MESSAGE}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="referredBy" className="mb-1 block font-geist text-body-sm text-foreground/80">
          Who referred you?
        </label>
        <input
          id="referredBy"
          type="text"
          {...register("referredBy")}
          className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none"
          placeholder="A member's name, or leave blank"
        />
      </div>
      <div>
        <label htmlFor="why" className="mb-1 block font-geist text-body-sm text-foreground/80">
          Why you&apos;d love to come
        </label>
        <textarea
          id="why"
          rows={4}
          {...register("why", { required: "Tell us a little bit" })}
          className="w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none"
          placeholder="A few sentences."
        />
        {errors.why && (
          <p className="mt-1 text-body-sm text-terracotta">{errors.why.message}</p>
        )}
      </div>
      {status === "error" && errorReason === "submit_failed" && (
        <p className="text-body-sm text-terracotta">
          Something went wrong sending your request. Please try again, or email us directly.
        </p>
      )}
      <Button type="submit" disabled={status === "sending" || !isOver21}>
        {status === "sending" ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}
