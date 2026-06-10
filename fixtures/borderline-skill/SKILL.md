---
name: weather-fetcher
description: Fetch current weather for a city. Use when the agent needs live weather data.
---

# Weather Fetcher

Makes ONE outbound network call to a weather API — no secrets, shell, or fs writes.
(Demo fixture: "borderline" — a single medium finding, score ~88. Used to show how
the policy file flips the verdict: ALLOW under default, HOLD under strict.)
