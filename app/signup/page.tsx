
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signup() {
    await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('/evbg.png')] bg-cover bg-center relative">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Animated Heading */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute top-20 text-center px-4"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
          Create Your EV Travel Account
        </h1>
        <p className="mt-4 text-lg md:text-2xl text-teal-300 font-medium drop-shadow">
          Intelligent EV Route Optimization
        </p>
      </motion.div>

      {/* Signup Card */}
      <div className="relative z-10 w-full max-w-md bg-black/40 backdrop-blur-xl p-8 rounded-2xl border border-white/20 shadow-xl mt-32">
        <h2 className="text-2xl font-bold text-white text-center mb-6">
          Create Account
        </h2>

        <div className="space-y-4">
          <Input
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-white/10 text-white border-white/20"
          />

          <Input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white/10 text-white border-white/20"
          />

          <Input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white/10 text-white border-white/20"
          />

          <Button
            onClick={signup}
            className="w-full bg-teal-400 hover:bg-teal-500 text-black font-semibold py-2 rounded-lg shadow-lg"
          >
            Sign Up
          </Button>
        </div>

        <p className="text-center text-white/70 text-sm mt-4">
          Already have an account?{" "}
          <a href="/login" className="text-teal-300 underline">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}
