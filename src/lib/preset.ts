import { SupportedPageType } from "@/lib/types";

export interface SlotDefinition {
  slotKey: string;
  label: string;
  required: boolean;
  keywords: string[];
  fallbackType?: "hero" | "contact" | "reviews" | "service" | "finance" | "story";
}

export const presetId = "ford-varsity" as const;

export const slotDefinitions: Record<SupportedPageType, SlotDefinition[]> = {
  homepage: [
    { slotKey: "hero_offer_strip", label: "Hero Offer Strip", required: true, keywords: ["welcome", "hero", "headline", "offer"], fallbackType: "hero" },
    { slotKey: "inventory_shortcuts", label: "Inventory Shortcuts", required: true, keywords: ["inventory", "search", "shop", "new", "used"] },
    { slotKey: "primary_cta_row", label: "Primary CTA Row", required: true, keywords: ["schedule", "trade", "finance", "contact"] },
    { slotKey: "model_lineup", label: "Model Lineup", required: true, keywords: ["model", "bronco", "explorer", "f-150", "maverick"] },
    { slotKey: "trust_value_props", label: "Trust Value Props", required: true, keywords: ["why", "trust", "promise", "warranty"], fallbackType: "story" },
    { slotKey: "reviews_or_social_proof", label: "Reviews", required: true, keywords: ["review", "testimonial", "customer"], fallbackType: "reviews" },
    { slotKey: "service_finance_support", label: "Service & Finance", required: true, keywords: ["service", "finance", "credit"], fallbackType: "service" },
    { slotKey: "about_local_market", label: "About & Local Market", required: true, keywords: ["about", "community", "history", "market"], fallbackType: "story" },
    { slotKey: "contact_hours_map", label: "Contact & Hours", required: true, keywords: ["contact", "hours", "map", "visit"], fallbackType: "contact" },
  ],
  about: [
    { slotKey: "intro", label: "Intro", required: true, keywords: ["about", "welcome", "history"], fallbackType: "story" },
    { slotKey: "story_or_history", label: "Story / History", required: true, keywords: ["history", "story", "began"], fallbackType: "story" },
    { slotKey: "why_buy_or_values", label: "Why Buy / Values", required: true, keywords: ["why", "values", "promise", "experience"], fallbackType: "story" },
    { slotKey: "community_or_market", label: "Community / Market", required: true, keywords: ["community", "serving", "local"], fallbackType: "story" },
    { slotKey: "reviews_or_awards", label: "Reviews / Awards", required: false, keywords: ["award", "review", "testimonial"], fallbackType: "reviews" },
    { slotKey: "contact_footer", label: "Contact Footer", required: true, keywords: ["contact", "hours", "visit"], fallbackType: "contact" },
  ],
  staff: [
    { slotKey: "intro", label: "Intro", required: true, keywords: ["team", "staff", "meet"], fallbackType: "story" },
    { slotKey: "department_groups", label: "Department Groups", required: true, keywords: ["sales", "service", "parts", "finance"] },
    { slotKey: "staff_cards", label: "Staff Cards", required: true, keywords: ["manager", "specialist", "consultant"] },
    { slotKey: "contact_cta", label: "Contact CTA", required: true, keywords: ["contact", "call", "email"], fallbackType: "contact" },
  ],
  contact: [
    { slotKey: "intro", label: "Intro", required: true, keywords: ["contact", "visit", "questions"], fallbackType: "contact" },
    { slotKey: "department_contacts", label: "Department Contacts", required: true, keywords: ["sales", "service", "parts", "phone"], fallbackType: "contact" },
    { slotKey: "address_and_map", label: "Address & Map", required: true, keywords: ["address", "map", "directions"], fallbackType: "contact" },
    { slotKey: "contact_form", label: "Contact Form", required: true, keywords: ["form", "message", "request"] },
    { slotKey: "directions_cta", label: "Directions CTA", required: false, keywords: ["directions", "get directions"], fallbackType: "contact" },
    { slotKey: "hours_linkout_or_embed", label: "Hours", required: false, keywords: ["hours", "visit"] },
  ],
  hours: [
    { slotKey: "intro", label: "Intro", required: true, keywords: ["hours", "visit"], fallbackType: "contact" },
    { slotKey: "hours_table", label: "Hours Table", required: true, keywords: ["monday", "friday", "hours"] },
    { slotKey: "department_contacts", label: "Department Contacts", required: false, keywords: ["sales", "service", "parts"], fallbackType: "contact" },
    { slotKey: "address_and_map", label: "Address & Map", required: true, keywords: ["address", "map", "directions"], fallbackType: "contact" },
    { slotKey: "directions_cta", label: "Directions CTA", required: true, keywords: ["directions", "visit"], fallbackType: "contact" },
  ],
  service: [
    { slotKey: "intro", label: "Intro", required: true, keywords: ["service", "repair", "maintenance"], fallbackType: "service" },
    { slotKey: "schedule_service_cta", label: "Schedule Service", required: true, keywords: ["schedule", "appointment"], fallbackType: "service" },
    { slotKey: "why_service_here", label: "Why Service Here", required: true, keywords: ["why choose", "benefit", "expert"], fallbackType: "service" },
    { slotKey: "service_capabilities", label: "Service Capabilities", required: true, keywords: ["oil", "brake", "battery", "tire"] },
    { slotKey: "owner_support_links", label: "Owner Support", required: false, keywords: ["ford owner", "parts", "owner"] },
    { slotKey: "service_specials_cta", label: "Service Specials", required: false, keywords: ["special", "coupon", "offer"] },
    { slotKey: "contact_hours_map", label: "Contact & Hours", required: true, keywords: ["hours", "contact", "visit"], fallbackType: "contact" },
  ],
  finance: [
    { slotKey: "intro", label: "Intro", required: true, keywords: ["finance", "payment", "credit"], fallbackType: "finance" },
    { slotKey: "finance_application_cta", label: "Finance Application", required: true, keywords: ["apply", "pre-approved", "application"], fallbackType: "finance" },
    { slotKey: "calculator_and_tools", label: "Calculators & Tools", required: false, keywords: ["calculator", "payment", "trade"] },
    { slotKey: "finance_support_copy", label: "Finance Support Copy", required: true, keywords: ["lease", "buy", "approval"], fallbackType: "finance" },
    { slotKey: "trade_support_cta", label: "Trade Support", required: false, keywords: ["trade", "value"] },
    { slotKey: "contact_cta", label: "Contact CTA", required: true, keywords: ["contact", "call"], fallbackType: "contact" },
  ],
  specials: [
    { slotKey: "intro", label: "Intro", required: true, keywords: ["special", "offer", "deal"], fallbackType: "hero" },
    { slotKey: "new_vehicle_offers", label: "New Vehicle Offers", required: true, keywords: ["new", "offer", "lease"] },
    { slotKey: "used_vehicle_offers", label: "Used Vehicle Offers", required: false, keywords: ["used", "pre-owned"] },
    { slotKey: "service_or_parts_offers", label: "Service / Parts Offers", required: false, keywords: ["service", "parts", "coupon"] },
    { slotKey: "oem_programs", label: "OEM Programs", required: false, keywords: ["program", "recognition", "military", "student"] },
    { slotKey: "contact_cta", label: "Contact CTA", required: true, keywords: ["contact", "call"], fallbackType: "contact" },
  ],
  trade_appraisal: [
    { slotKey: "intro", label: "Intro", required: true, keywords: ["trade", "sell", "appraisal"], fallbackType: "hero" },
    { slotKey: "valuation_cta", label: "Valuation CTA", required: true, keywords: ["value", "cash offer", "appraisal"] },
    { slotKey: "upgrade_or_exchange_copy", label: "Upgrade Copy", required: true, keywords: ["upgrade", "exchange", "trade up"], fallbackType: "story" },
    { slotKey: "third_party_trade_tools", label: "Trade Tools", required: false, keywords: ["kbb", "carfax", "instant cash"] },
    { slotKey: "contact_cta", label: "Contact CTA", required: true, keywords: ["contact", "call"], fallbackType: "contact" },
  ],
  research_model: [
    { slotKey: "intro", label: "Intro", required: true, keywords: ["ford", "model", "research"], fallbackType: "hero" },
    { slotKey: "model_summary", label: "Model Summary", required: true, keywords: ["overview", "summary", "features"], fallbackType: "story" },
    { slotKey: "feature_or_trim_blocks", label: "Feature / Trim Blocks", required: true, keywords: ["trim", "feature", "capability"] },
    { slotKey: "comparison_or_buying_guidance", label: "Buying Guidance", required: false, keywords: ["compare", "guide", "buy"] },
    { slotKey: "inventory_or_order_cta", label: "Inventory / Order CTA", required: true, keywords: ["inventory", "order", "shop"] },
    { slotKey: "contact_cta", label: "Contact CTA", required: true, keywords: ["contact", "call"], fallbackType: "contact" },
  ],
  local_seo_landing: [
    { slotKey: "intro", label: "Intro", required: true, keywords: ["serving", "near", "local"], fallbackType: "hero" },
    { slotKey: "localized_value_prop", label: "Localized Value Prop", required: true, keywords: ["community", "local", "market"], fallbackType: "story" },
    { slotKey: "primary_offer_or_service", label: "Primary Offer / Service", required: true, keywords: ["service", "inventory", "special"] },
    { slotKey: "trust_or_reviews", label: "Trust / Reviews", required: false, keywords: ["review", "trust", "testimonial"], fallbackType: "reviews" },
    { slotKey: "contact_hours_map", label: "Contact & Hours", required: true, keywords: ["contact", "hours", "directions"], fallbackType: "contact" },
  ],
};
