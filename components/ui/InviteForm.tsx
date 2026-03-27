"use client";

import { useForm } from "react-hook-form";
import { useRef, useState } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { Button } from "./Button";

type InviteFormData = {
  name: string;
  email: string;
  referredBy: string;
  why: string;
  "h-captcha-response": string;
};

export function InviteForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorReason, setErrorReason] = useState<
    "captcha_missing" | "submit_failed" | null
  >(null);
  const captchaRef = useRef<HCaptcha | null>(null);
  const captchaSiteKey =
    process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY?.trim() ||
    process.env.NEXT_PUBLIC_WEB3FORMS_HCAPTCHA_SITEKEY?.trim() ||
    "50b2fe65-b00b-4b9e-ad62-3ba471098be2";
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>();

  const onSubmit = async (data: InviteFormData) => {
    if (!data["h-captcha-response"]) {
      setErrorReason("captcha_missing");
      setStatus("error");
      return;
    }
    setErrorReason(null);
    setStatus("sending");
    try {
      const res = await fetch("/.netlify/functions/submit-invite-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          referredBy: data.referredBy,
          why: data.why,
          hCaptchaToken: data["h-captcha-response"],
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && json.ok) {
        setStatus("success");
        reset();
        captchaRef.current?.resetCaptcha();
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
        Thank you. We&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-xl space-y-6"
    >
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
      <input
        type="hidden"
        {...register("h-captcha-response", { required: "Please complete the captcha challenge." })}
      />
      <div className="overflow-x-auto">
        <HCaptcha
          ref={captchaRef}
          sitekey={captchaSiteKey}
          reCaptchaCompat={false}
          onVerify={(token) => {
            setValue("h-captcha-response", token, { shouldValidate: true });
            setErrorReason(null);
          }}
          onExpire={() => {
            setValue("h-captcha-response", "", { shouldValidate: true });
          }}
        />
      </div>
      {errors["h-captcha-response"] && (
        <p className="text-body-sm text-terracotta">{errors["h-captcha-response"].message}</p>
      )}
      {status === "error" && errorReason === "captcha_missing" && (
        <p className="text-body-sm text-terracotta">Please complete the captcha challenge, then submit again.</p>
      )}
      {status === "error" && errorReason === "submit_failed" && (
        <p className="text-body-sm text-terracotta">
          Something went wrong sending your request. Please try again, or email us directly.
        </p>
      )}
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}
