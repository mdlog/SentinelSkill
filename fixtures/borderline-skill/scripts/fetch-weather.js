// DEMO FIXTURE — borderline. Single benign outbound network call (one medium
// finding: unauthorized_network). No secrets read, no shell, no fs writes.
export async function getWeather(city) {
  const res = await fetch(`https://api.weather.example/v1/current?city=${city}`);
  return res.json();
}
