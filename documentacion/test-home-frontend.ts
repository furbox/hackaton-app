#!/usr/bin/env bun

// Test script to check what the home controller receives

async function testHome() {
  try {
    const response = await fetch("http://localhost:3001/");
    const html = await response.text();

    // Search for DEBUG comments
    const debugMatches = html.match(/<!-- DEBUG: Link ID \d+.*?-->/g);
    if (debugMatches) {
      console.log("\n✅ Found DEBUG comments:");
      debugMatches.slice(0, 3).forEach(m => console.log("  ", m));
    } else {
      console.log("\n❌ No DEBUG comments found - template may not be executing");
    }

    // Search for test indicator
    const hasHardcoded = html.includes("TEST HARDCODED");
    console.log(`\n${hasHardcoded ? "✅" : "❌"} Hardcoded test indicator: ${hasHardcoded ? "PRESENT" : "NOT FOUND"}`);

    // Search for conditional indicator
    const hasConditional = html.includes("bg-emerald-500") || html.includes("bg-red-500");
    console.log(`${hasConditional ? "✅" : "❌"} Conditional status indicator: ${hasConditional ? "PRESENT" : "NOT FOUND"}`);

    // Count link cards
    const linkCardMatches = html.match(/data-favorite-card="true"/g);
    console.log(`\n📊 Link cards found: ${linkCardMatches?.length || 0}`);

    // Search for featured links section
    const hasFeaturedSection = html.includes("Featured Links");
    console.log(`${hasFeaturedSection ? "✅" : "❌"} Featured links section: ${hasFeaturedSection ? "PRESENT" : "NOT FOUND"}`);

  } catch (error) {
    console.error("Error:", error);
  }
}

testHome();
