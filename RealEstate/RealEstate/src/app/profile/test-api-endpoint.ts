async function testApi() {
  console.log("🧪 Automated API Endpoint Proximity Check...");
  
  const url = "http://localhost:3000/api/estimate-price?lat=24.8436&lng=93.9450&propertyType=HOUSE&areaSqft=2500";
  console.log(`🌐 Querying endpoint: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }

    const payload = await res.json();
    console.log("📥 API Response Payload received:");
    console.log(JSON.stringify(payload, null, 2));

    if (payload.success && payload.data && typeof payload.data.estimatedPrice === "number") {
      console.log("\n✅ API Automated Verification Passed!");
      console.log(`🏠 Estimated Valuation: INR ${payload.data.estimatedPrice.toLocaleString()}`);
      console.log(`📊 Confidence: ${payload.data.confidence}`);
    } else {
      console.error("\n❌ API Response format validation failed:", payload);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Automated API testing failed with error:", error);
    process.exit(1);
  }
}

testApi();
