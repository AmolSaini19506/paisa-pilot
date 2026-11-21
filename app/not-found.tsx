import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, textAlign: "center" }}>
      <div>
        <div style={{ fontSize: 56 }}>🧭</div>
        <h1 style={{ margin: "12px 0 6px" }}>This page took a wrong turn</h1>
        <p className="muted" style={{ marginBottom: 18 }}>The link may be old or mistyped. Your money data is safe.</p>
        <Link href="/home" className="btn">Back to Money Twin</Link>
      </div>
    </div>
  );
}
