"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function login() {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok) window.location.href = "/";
    else alert(data.error || "Invalid credentials");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative bg-[url('/evbg.png')]">

      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute top-20 text-center px-4"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
          Find the Best Charging Station Near You
        </h1>

        <p className="mt-4 text-lg md:text-2xl text-teal-300 font-medium drop-shadow">
          Intelligent EV Route Optimization
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 w-full max-w-md shadow-2xl"
      >
        <h2 className="text-2xl font-bold text-white text-center mb-6">
          Login to Continue
        </h2>

        <Input
          placeholder="Email"
          className="mb-4 bg-white/20 text-white placeholder-white/60 border-white/30"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          placeholder="Password"
          type="password"
          className="mb-4 bg-white/20 text-white placeholder-white/60 border-white/30"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          onClick={login}
          className="w-full bg-teal-400 hover:bg-teal-500 text-black font-semibold py-2 rounded-lg shadow-lg"
        >
          Login
        </Button>

        <p className="text-center text-white/70 text-sm mt-4">
          Don’t have an account?{" "}
          <a href="/signup" className="text-teal-300 underline">
            Sign Up
          </a>
        </p>
      </motion.div>
    </div>
  );
}
