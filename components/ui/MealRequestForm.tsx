"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "./Button";
import { netlifyFunctionUrl } from "@/lib/netlify-paths";

type FormData = {
  name: string;
  email: string;
};

type Props = {
  dinnerId: string;
  dinnerLabel?: string;
};

export function MealRequestForm({ dinnerId, dinnerLabel }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setStatus("sending");
    setErrorMsg(null);
    try {
      const res = await fetch(netlifyFunctionUrl("request-meal-seat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, name: data.name, dinnerId }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setStatus("success");
      reset();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <p className="font-geist text-body-lg text-foreground/90">
        Check your email to create your password and complete your seat request
        {dinnerLabel ? ` for ${dinnerLabel}` : ""}.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-xl space-y-6">
      <div>
        <label htmlFor="meal-name" className="mb-1 block font-geist text-body-sm text-foreground/80">
          Name
        </label>
        <input
          id="meal-name"
          type="text"
          {...register("name", { required: "Name is required" })}
          className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none"
          placeholder="Your name"
        />
        {errors.name && <p className="mt-1 text-body-sm text-terracotta">{errors.name.message}</p>}
      </div>
      <div>
        <label htmlFor="meal-email" className="mb-1 block font-geist text-body-sm text-foreground/80">
          Email
        </label>
        <input
          id="meal-email"
          type="email"
          {...register("email", { required: "Email is required" })}
          className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none"
          placeholder="you@example.com"
        />
        {errors.email && <p className="mt-1 text-body-sm text-terracotta">{errors.email.message}</p>}
      </div>
      {status === "error" && errorMsg && (
        <p className="text-body-sm text-terracotta">{errorMsg}</p>
      )}
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Request a seat"}
      </Button>
    </form>
  );
}
