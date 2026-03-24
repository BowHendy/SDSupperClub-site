"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { Button } from "./Button";

type InviteFormData = {
  name: string;
  email: string;
  referredBy: string;
  why: string;
};

export function InviteForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>();

  const onSubmit = async (data: InviteFormData) => {
    const key = process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
    if (!key) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_key: key,
          name: data.name,
          email: data.email,
          referred_by: data.referredBy,
          why: data.why,
          subject: "SDSupperClub — Invitation Request",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus("success");
        reset();
      } else {
        setStatus("error");
      }
    } catch {
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
      {status === "error" && (
        <p className="text-body-sm text-terracotta">
          Something went wrong. Please try again or email us directly.
        </p>
      )}
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}
