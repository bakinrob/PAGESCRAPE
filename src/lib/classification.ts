import { ClassificationResult } from "@/lib/types";

const MODEL_PATTERN =
  /\b(20(2[4-9]|3[0-5])\s+ford\s+|bronco|bronco sport|escape|explorer|expedition|f-150|f-250|f-350|mustang|mach-e|maverick|ranger|transit)\b/i;

function normalize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replaceAll("-", " ").replace(/\s+/g, " ").trim();
}

function makeResult(
  pageType: ClassificationResult["page_type"],
  matchedSignals: string[],
  ambiguityNotes: string[],
  confidence: number,
): ClassificationResult {
  return {
    page_type: pageType,
    supported: !pageType.startsWith("unsupported_"),
    confidence,
    matched_signals: matchedSignals,
    ambiguity_notes: ambiguityNotes,
  };
}

function hasAnyToken(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

export function classifyPage(url: string, title = "", h1 = ""): ClassificationResult {
  const parsed = new URL(url);
  const path = parsed.pathname.toLowerCase();
  const text = [url, title, h1].map(normalize).join(" ");
  const matched: string[] = [];
  const notes: string[] = [];

  const hit = (condition: boolean, signal: string) => {
    if (condition) {
      matched.push(signal);
      return true;
    }

    return false;
  };

  if (hit(["/vehicle-details", "/vehicledetails", "vin=", "stock="].some((token) => path.includes(token) || parsed.search.includes(token)), "path:vehicle-details-or-stock")) {
    return makeResult("unsupported_vehicle_vdp", matched, notes, 0.99);
  }

  if (
    hit(
      [
        "/inventory",
        "/new-inventory",
        "/used-inventory",
        "/new-vehicles",
        "/used-vehicles",
        "/searchinventory",
        "/vehicles-for-sale",
        "/new-cars",
        "/used-cars",
      ].some((token) => path.includes(token)),
      "path:inventory-srp",
    )
  ) {
    return makeResult("unsupported_inventory_srp", matched, notes, 0.98);
  }

  if (hit(["/checkout", "/payment", "/buy-online"].some((token) => path.includes(token)), "path:checkout")) {
    return makeResult("unsupported_checkout", matched, notes, 0.98);
  }

  if (path === "/" || path === "") {
    matched.push("path:root-homepage");
    if (!text.includes("welcome to") && !text.includes("dealership")) {
      notes.push("homepage inferred from root path more than page copy");
    }

    return makeResult("homepage", matched, notes, 0.96);
  }

  if (
    hit(
      hasAnyToken(path, ["/staff", "/team", "/meet-our-team"]) ||
        hasAnyToken(text, ["meet our team", "staff directory", "sales team", "our team"]),
      hasAnyToken(path, ["/staff", "/team", "/meet-our-team"]) ? "path:staff" : "text:staff",
    )
  ) {
    return makeResult("staff", matched, notes, 0.97);
  }

  if (
    hit(
      hasAnyToken(path, ["/contact-us", "/contact"]) ||
        hasAnyToken(text, ["contact us", "contact our dealership", "phone number", "get in touch"]),
      hasAnyToken(path, ["/contact-us", "/contact"]) ? "path:contact" : "text:contact",
    )
  ) {
    return makeResult("contact", matched, notes, 0.96);
  }

  if (
    hit(
      hasAnyToken(path, ["/hours", "/directions", "/hours-and-directions"]) ||
        hasAnyToken(text, ["hours and directions", "store hours", "department hours", "hours & directions"]),
      hasAnyToken(path, ["/hours", "/directions", "/hours-and-directions"]) ? "path:hours" : "text:hours",
    )
  ) {
    return makeResult("hours", matched, notes, 0.95);
  }

  if (
    hit(
      hasAnyToken(path, ["/service", "/service-center", "/parts", "/auto-repair", "/mobile-service"]) ||
        hasAnyToken(text, ["service center", "schedule service", "auto repair", "ford service", "parts center", "mobile service"]),
      hasAnyToken(path, ["/service", "/service-center", "/parts", "/auto-repair", "/mobile-service"]) ? "path:service" : "text:service",
    )
  ) {
    if (path.includes("special") || path.includes("coupon")) {
      notes.push("service path also contains specials signal");
    }

    return makeResult("service", matched, notes, 0.95);
  }

  if (
    hit(
      hasAnyToken(path, ["/finance", "/apply", "/pre-approved", "/payment-calculator", "/leasing"]) ||
        hasAnyToken(text, ["finance center", "apply for credit", "auto finance", "payment calculator", "leasing"]),
      hasAnyToken(path, ["/finance", "/apply", "/pre-approved", "/payment-calculator", "/leasing"]) ? "path:finance" : "text:finance",
    )
  ) {
    return makeResult("finance", matched, notes, 0.95);
  }

  if (
    hit(
      hasAnyToken(path, ["/special", "/offer", "/coupon", "/incentive", "/deal"]) ||
        hasAnyToken(text, ["special offers", "service specials", "new specials", "lease deals", "coupons"]),
      hasAnyToken(path, ["/special", "/offer", "/coupon", "/incentive", "/deal"]) ? "path:specials" : "text:specials",
    )
  ) {
    return makeResult("specials", matched, notes, 0.95);
  }

  if (
    hit(
      hasAnyToken(path, ["/trade", "/sell-my-car", "/appraisal", "/instant-cash-offer"]) ||
        hasAnyToken(text, ["value your trade", "sell my car", "trade appraisal", "instant cash offer"]),
      hasAnyToken(path, ["/trade", "/sell-my-car", "/appraisal", "/instant-cash-offer"]) ? "path:trade-appraisal" : "text:trade-appraisal",
    )
  ) {
    return makeResult("trade_appraisal", matched, notes, 0.95);
  }

  if (
    hit(
      hasAnyToken(path, ["/about-us", "/about", "/why-buy", "/history"]) ||
        hasAnyToken(text, ["about us", "about our dealership", "why buy", "our history"]),
      hasAnyToken(path, ["/about-us", "/about", "/why-buy", "/history"]) ? "path:about" : "text:about",
    )
  ) {
    return makeResult("about", matched, notes, 0.92);
  }

  if (hit(["/near-", "/serving-", "/dealer-in-", "/ford-dealer-", "/service-near-"].some((token) => path.includes(token)), "path:local-seo")) {
    return makeResult("local_seo_landing", matched, notes, 0.88);
  }

  if (
    hit(
      hasAnyToken(path, ["/research", "/model-showroom", "/showroom"]) || MODEL_PATTERN.test(text),
      "path-or-text:research-model",
    )
  ) {
    if (text.includes("near ") || text.includes("serving ")) {
      notes.push("research page also carries local SEO language");
    }

    return makeResult("research_model", matched, notes, 0.9);
  }

  if (text.includes("near ") || text.includes("serving ")) {
    matched.push("text:local-market-language");
    return makeResult("local_seo_landing", matched, notes, 0.7);
  }

  notes.push("no strong taxonomy signal matched");
  return makeResult("unsupported_other", matched, notes, 0.4);
}
