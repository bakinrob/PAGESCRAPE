import type { CSSProperties } from "react";

import { MapPin, Phone } from "lucide-react";

import type { MappedContentBlock, MappedPagePayload, MappedSection } from "@/lib/types";
import { buildTemplatePackageBaseHref, injectTemplatePackageBase } from "@/lib/package-preview";
import { choosePreviewMode } from "@/lib/workspace-view-state";

import styles from "./template-preview.module.css";

function getSection(mapped: MappedPagePayload, slotKey: string) {
  return mapped.sections.find((section) => section.slot_key === slotKey);
}

function blockValue(section: MappedSection | undefined, type: MappedContentBlock["type"]) {
  return section?.content_blocks.find((block) => block.type === type)?.value;
}

function firstParagraph(section: MappedSection | undefined) {
  return (
    section?.content_blocks.find((block) => block.type === "paragraph")?.value ||
    section?.content_blocks.find((block) => block.type === "review_snippet")?.value ||
    ""
  );
}

function bulletItems(section: MappedSection | undefined) {
  return (
    blockValue(section, "bullet_list")
      ?.split(/\n|•/)
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

function allParagraphs(section: MappedSection | undefined) {
  return (
    section?.content_blocks
      .filter((block) => block.type === "paragraph")
      .map((block) => block.value)
      .filter(Boolean) ?? []
  );
}

function addressBlock(section: MappedSection | undefined) {
  return blockValue(section, "address_block");
}

function phoneLines(section: MappedSection | undefined) {
  return (
    blockValue(section, "phone_block")
      ?.split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean) ?? []
  );
}

function reviewText(section: MappedSection | undefined) {
  return blockValue(section, "review_snippet") || firstParagraph(section);
}

function heading(section: MappedSection | undefined, fallback: string) {
  return blockValue(section, "heading") || fallback;
}

function sectionImage(section: MappedSection | undefined) {
  return section?.media_refs[0];
}

function ctas(section: MappedSection | undefined, limit = 3) {
  return section?.ctas.slice(0, limit) ?? [];
}

function fallbackHref(cta?: { href: string }) {
  return cta?.href || "#";
}

const DEFAULT_MODELS = [
  {
    name: "F-150",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=240&h=140&fit=crop&q=80",
  },
  {
    name: "Explorer",
    image: "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=240&h=140&fit=crop&q=80",
  },
  {
    name: "Bronco",
    image: "https://images.unsplash.com/photo-1568844293986-8d0400f3f2d4?w=240&h=140&fit=crop&q=80",
  },
  {
    name: "Mustang",
    image: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=240&h=140&fit=crop&q=80",
  },
  {
    name: "Escape",
    image: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=240&h=140&fit=crop&q=80",
  },
  {
    name: "Expedition",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=240&h=140&fit=crop&q=80",
  },
];

function QuickLinkIcon({ index }: { index: number }) {
  const icons = [
    <svg key="inventory" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 15.5V11l4-4h8l4 4v4.5" />
      <circle cx="7.5" cy="16.5" r="2" />
      <circle cx="16.5" cy="16.5" r="2" />
      <path d="M5.5 16.5h9" />
    </svg>,
    <svg key="check" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m5 12 4 4L19 6" />
    </svg>,
    <svg key="tag" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7h11l7 5-7 5H3z" />
      <circle cx="7" cy="12" r="1.5" />
    </svg>,
    <svg key="wrench" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 4h5v5" />
      <path d="M10 20H5v-5" />
      <path d="M19 4 9 14" />
      <path d="m5 20 4-4" />
    </svg>,
    <svg key="bolt" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>,
  ];

  return <span className={styles.quickLinkIcon}>{icons[index % icons.length]}</span>;
}

function ActionButtons({ items, ghost }: { items: Array<{ label: string; href: string }>; ghost?: boolean }) {
  if (items.length === 0) return null;

  return (
    <div className={styles.ctaRow}>
      {items.map((item, index) => (
        <a
          key={`${item.href}-${item.label}-${index}`}
          href={fallbackHref(item)}
          className={ghost ? styles.ctaButtonGhost : styles.ctaButton}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className={styles.emptyState}>{label}</div>;
}

function PackagePreviewFrame({
  html,
  templatePath,
  confidence,
  destinationLabel,
  templatePackageId,
}: {
  html: string;
  templatePath: string;
  confidence: number;
  destinationLabel?: string;
  templatePackageId?: string;
}) {
  const previewDocument = templatePackageId
    ? injectTemplatePackageBase(html, buildTemplatePackageBaseHref(templatePackageId, templatePath))
    : html;

  return (
    <div className={`${styles.page} ${styles.packagePreviewShell}`}>
      <div className={styles.packagePreviewHeader}>
        <div>
          <p className={styles.sectionEyebrow}>Package-driven rebuild</p>
          <h3 className={styles.packagePreviewTitle}>
            {destinationLabel ? `${destinationLabel} destination template` : "Destination template preview"}
          </h3>
        </div>
        <div className={styles.packagePreviewMeta}>
          <span>{templatePath}</span>
          <span>{Math.round(confidence * 100)}% match</span>
        </div>
      </div>
      <div className={styles.packagePreviewFrame}>
        <iframe
          title={`Package preview for ${templatePath}`}
          srcDoc={previewDocument}
          className={styles.packagePreviewIframe}
          sandbox=""
        />
      </div>
    </div>
  );
}

function PendingPackagePreview({
  mapped,
  templatePath,
}: {
  mapped?: MappedPagePayload;
  templatePath: string;
}) {
  return (
    <div className={styles.pendingPreviewShell}>
      <div className={styles.pendingPreviewNotice}>
        <p className={styles.sectionEyebrow}>Destination match found</p>
        <h3 className={styles.packagePreviewTitle}>Package rebuild output is not available yet.</h3>
        <p className={styles.cardText}>
          The workspace matched this page to <strong>{templatePath}</strong>, but the package-driven
          HTML has not been generated. The mapped fallback stays visible below so the review can
          continue without pretending this is the final destination render.
        </p>
      </div>
      {mapped ? renderPreviewByType(mapped) : <EmptyState label="No mapped fallback is available for this page yet." />}
    </div>
  );
}

function HomepageTemplate({ mapped }: { mapped: MappedPagePayload }) {
  const hero = getSection(mapped, "hero_offer_strip");
  const inventory = getSection(mapped, "inventory_shortcuts");
  const primary = getSection(mapped, "primary_cta_row");
  const lineup = getSection(mapped, "model_lineup");
  const trust = getSection(mapped, "trust_value_props");
  const reviews = getSection(mapped, "reviews_or_social_proof");
  const support = getSection(mapped, "service_finance_support");
  const about = getSection(mapped, "about_local_market");
  const contact = getSection(mapped, "contact_hours_map");

  const contactPhones = phoneLines(contact);
  const heroActions = ctas(hero, 2);
  const quickLinks = ctas(inventory, 5);
  const primaryActions = ctas(primary, 3);
  const supportActions = ctas(support, 3);
  const contactActions = ctas(contact, 2);
  const trustBullets = bulletItems(trust);
  const reviewCopy = reviewText(reviews);
  const modelItems = bulletItems(lineup);
  const aboutCopy = allParagraphs(about);
  const footerAddress = addressBlock(contact);
  const heroImage = sectionImage(hero);
  const modelEntries =
    modelItems.length > 0
      ? modelItems.map((item, index) => ({
          name: item,
          image: DEFAULT_MODELS[index % DEFAULT_MODELS.length]?.image,
        }))
      : DEFAULT_MODELS;
  const heroStyle = heroImage
    ? ({
        ["--hero-image" as string]: `url("${heroImage}")`,
      } satisfies CSSProperties)
    : undefined;

  return (
    <div className={`${styles.page} ${styles.templateFrame}`}>
      <div className={styles.topbar}>
        <div className={styles.topbarGroup}>
          {contactPhones.slice(0, 3).map((line, index) => (
            <span key={`${line}-${index}`}>{line}</span>
          ))}
        </div>
        <div className={styles.topbarGroup}>
          {footerAddress ? <span>{footerAddress}</span> : null}
          <span className={styles.topbarPill}>English</span>
        </div>
      </div>

      <div className={styles.navbar}>
        <div className={styles.brandLockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ford-oval.svg" alt="Ford" className={styles.brandOval} />
          <div className={styles.brandMark}>
            <span className={styles.brandMain}>VARSITY</span>
            <span className={styles.brandSub}>Ford</span>
          </div>
        </div>
        <div className={styles.navLinks}>
          {["Specials", "New", "Used", "Work Trucks", "About Us", "Service & Parts", "Finance"].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <span className={styles.navSearch}>Search</span>
      </div>

      <section className={styles.hero} style={heroStyle}>
        <div className={styles.heroBackdrop} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <span className={styles.heroEyebrow}>{heading(hero, "Current Ford offers")}</span>
          <h2 className={styles.heroTitle}>{mapped.seo.h1 || mapped.seo.title}</h2>
          <p className={styles.heroCopy}>
            {firstParagraph(hero) || mapped.seo.meta_description || "The rebuilt homepage preserves the source offer and destination template structure."}
          </p>
          <div className={styles.heroButtons}>
            {heroActions[0] ? (
              <a href={fallbackHref(heroActions[0])} className={styles.heroButtonPrimary}>
                {heroActions[0].label}
              </a>
            ) : null}
            {heroActions[1] ? (
              <a href={fallbackHref(heroActions[1])} className={styles.heroButtonSecondary}>
                {heroActions[1].label}
              </a>
            ) : null}
          </div>
          <div className={styles.heroStatusStrip}>
            {primaryActions.slice(0, 3).map((cta) => (
              <span key={`${cta.href}-${cta.label}`}>{cta.label}</span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.quickLinksGrid}>
            {quickLinks.length > 0
              ? quickLinks.map((cta, index) => (
                  <a key={`${cta.href}-${cta.label}`} href={fallbackHref(cta)} className={styles.quickLinkCard}>
                    <QuickLinkIcon index={index} />
                    <span className={styles.quickLinkLabel}>{cta.label}</span>
                    <span className={styles.quickLinkSub}>Explore</span>
                  </a>
                ))
              : Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className={styles.quickLinkCard}>
                    <QuickLinkIcon index={index} />
                    <span className={styles.quickLinkLabel}>Static migration target</span>
                    <span className={styles.quickLinkSub}>No trustworthy shortcut found</span>
                  </div>
                ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <p className={styles.bannerText}>
            {heading(primary, "Moving static dealer pages into the new template")}
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionTitle}>
            <p className={styles.sectionEyebrow}>Ford lineup</p>
            <h3 className={styles.sectionHeading}>{heading(lineup, "Popular Ford models")}</h3>
          </div>
          <div className={styles.lineupTabs}>
            {["SUVs & Cars", "Trucks & Vans", "Electric", "Commercial"].map((item, index) => (
              <span key={item} className={`${styles.lineupTab} ${index === 0 ? styles.lineupTabActive : ""}`}>
                {item}
              </span>
            ))}
          </div>
          <div className={styles.modelRail}>
            {modelEntries.map((item) => (
              <div key={item.name} className={styles.modelCard}>
                <div className={styles.modelVisual}>
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className={styles.modelImage} />
                  ) : null}
                  <span className={styles.modelGlow} />
                </div>
                <span className={styles.modelName}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.departmentGrid}>
            {[
              {
                title: quickLinks[0]?.label || "New Ford vehicles",
                sub: quickLinks[0]?.label ? "Shop now" : "Preserved inventory path",
                href: quickLinks[0]?.href || "#",
                image: sectionImage(inventory) || sectionImage(hero),
              },
              {
                title: supportActions[0]?.label || "Schedule service",
                sub: supportActions[0]?.label ? "Book now" : "Service migration path",
                href: supportActions[0]?.href || "#",
                image: sectionImage(support) || sectionImage(hero),
              },
              {
                title: primaryActions[0]?.label || "Contact the dealership",
                sub: primaryActions[0]?.label ? "Take action" : "Dealer support preserved",
                href: primaryActions[0]?.href || "#",
                image: sectionImage(about) || sectionImage(hero),
              },
            ].map((card, index) => (
              <a
                key={card.title}
                href={card.href}
                className={`${styles.departmentCard} ${styles[`departmentCard${index}`] || ""}`}
              >
                {card.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.image} alt={card.title} className={styles.departmentImage} />
                ) : (
                  <div className={`${styles.departmentFallback} ${styles[`departmentFallback${index}`] || ""}`} />
                )}
                <div className={styles.departmentContent}>
                  <h4 className={styles.departmentTitle}>{card.title}</h4>
                  <span className={styles.departmentLink}>{card.sub}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.splitGrid}>
            <div className={styles.promoBand}>
              {sectionImage(primary) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sectionImage(primary)} alt={heading(primary, "Current offers")} className={styles.promoImage} />
              ) : null}
              <div className={styles.promoOverlay} />
              <div className={styles.promoContent}>
                <h3 className={styles.promoHeading}>{heading(primary, "Current offers and incentives")}</h3>
                <p className={styles.promoText}>
                  {firstParagraph(primary) || firstParagraph(trust) || "The destination homepage keeps current offers and CTA priority intact."}
                </p>
                <ActionButtons items={primaryActions.slice(0, 2)} />
              </div>
            </div>

            <div className={styles.cardStack}>
              <div className={styles.trustCard}>
                <p className={styles.sectionEyebrow}>Trust and value</p>
                <h3 className={styles.cardHeading}>{heading(trust, `Why choose ${mapped.dealer_name}`)}</h3>
                {trustBullets.length > 0 ? (
                  <div className={styles.bulletList}>
                    {trustBullets.slice(0, 4).map((item) => (
                      <div key={item} className={styles.bulletItem}>
                        {item}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.cardText}>{firstParagraph(trust) || "Trust and proof stay preserved when the source provides them."}</p>
                )}
              </div>
              <div className={styles.trustCard}>
                <p className={styles.sectionEyebrow}>Customer proof</p>
                <h3 className={styles.cardHeading}>{heading(reviews, "Reviews and social proof")}</h3>
                {reviewCopy ? (
                  <blockquote className={styles.proofQuote}>{reviewCopy}</blockquote>
                ) : (
                  <EmptyState label="No trustworthy review module was preserved for this page yet." />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.sectionMuted}>
        <div className={styles.container}>
          <div className={styles.dealerInfoGrid}>
            <div className={styles.infoCard}>
              <p className={styles.sectionEyebrow}>Local dealer story</p>
              <h3 className={styles.cardHeading}>{heading(about, mapped.dealer_name)}</h3>
              {aboutCopy.length > 0 ? (
                aboutCopy.slice(0, 2).map((paragraph) => (
                  <p key={paragraph} className={styles.cardText}>
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className={styles.cardText}>
                  {firstParagraph(about) || "Local market positioning and dealer story are preserved from the source copy."}
                </p>
              )}
              <ActionButtons items={ctas(about, 2)} />
            </div>

            <div className={styles.detailsCard}>
              <p className={styles.sectionEyebrow}>Visit the dealership</p>
              <h3 className={styles.cardHeading}>{heading(contact, `Visit ${mapped.dealer_name}`)}</h3>
              {footerAddress ? <p className={styles.cardText}>{footerAddress}</p> : null}
              {contactPhones.length > 0 ? (
                <div className={styles.hoursList}>
                  {contactPhones.map((line) => (
                    <div key={line} className={styles.hoursItem}>
                      <span>
                        <Phone size={14} style={{ display: "inline", marginRight: 6 }} />
                        Contact
                      </span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className={styles.mapPanel}>
                <div>
                  <MapPin size={18} style={{ margin: "0 auto 8px" }} />
                  <p>Map, directions, and hours stay structured in the destination template.</p>
                </div>
              </div>
              <ActionButtons items={contactActions} />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaStrip}>
        <div className={styles.container}>
          <h3 className={styles.ctaStripHeading}>Ready to move the next static page?</h3>
          <ActionButtons items={(primaryActions.concat(contactActions)).slice(0, 2)} ghost />
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerGrid}`}>
          <div>
            <h4 className={styles.footerHeading}>{mapped.dealer_name}</h4>
            <div className={styles.footerList}>
              {footerAddress ? <span>{footerAddress}</span> : null}
              {contactPhones.slice(0, 3).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          </div>
          <div>
            <h4 className={styles.footerHeading}>Inventory</h4>
            <div className={styles.footerList}>
              {(quickLinks.length > 0 ? quickLinks : primaryActions).slice(0, 5).map((cta) => (
                <span key={`${cta.href}-${cta.label}`}>{cta.label}</span>
              ))}
            </div>
          </div>
          <div>
            <h4 className={styles.footerHeading}>Services</h4>
            <div className={styles.footerList}>
              {(supportActions.length > 0 ? supportActions : primaryActions).slice(0, 5).map((cta) => (
                <span key={`${cta.href}-${cta.label}`}>{cta.label}</span>
              ))}
            </div>
          </div>
          <div>
            <h4 className={styles.footerHeading}>Migration notes</h4>
            <div className={styles.footerList}>
              <span>Static page rebuild</span>
              <span>SEO metadata preserved</span>
              <span>Provider-ready HTML export</span>
            </div>
          </div>
        </div>
        <div className={`${styles.container} ${styles.footerNote}`}>
          Rebuilt from the source page using the uploaded destination migration template.
        </div>
      </footer>
    </div>
  );
}

function InnerHero({
  mapped,
  section,
  eyebrow,
}: {
  mapped: MappedPagePayload;
  section: MappedSection | undefined;
  eyebrow: string;
}) {
  return (
    <section className={styles.innerHero}>
      {sectionImage(section) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sectionImage(section)} alt={heading(section, mapped.seo.title)} className={styles.innerHeroImage} />
      ) : null}
      <div className={styles.innerHeroOverlay} />
      <div className={styles.innerHeroContent}>
        <span className={styles.heroEyebrow}>{eyebrow}</span>
        <h2 className={styles.innerHeroTitle}>{mapped.seo.h1 || mapped.seo.title}</h2>
        <p className={styles.innerHeroText}>
          {firstParagraph(section) || mapped.seo.meta_description || "This rebuilt page preserves source content inside the destination template."}
        </p>
        <ActionButtons items={ctas(section, 2)} />
      </div>
    </section>
  );
}

function ContentCard({
  eyebrow,
  title,
  section,
}: {
  eyebrow: string;
  title: string;
  section: MappedSection | undefined;
}) {
  const paragraphs = allParagraphs(section);
  const bullets = bulletItems(section);
  const review = reviewText(section);

  return (
    <div className={styles.infoCard}>
      <p className={styles.sectionEyebrow}>{eyebrow}</p>
      <h3 className={styles.cardHeading}>{heading(section, title)}</h3>
      {paragraphs.length > 0 ? (
        paragraphs.slice(0, 2).map((paragraph) => (
          <p key={paragraph} className={styles.cardText}>
            {paragraph}
          </p>
        ))
      ) : bullets.length > 0 ? (
        <div className={styles.bulletList}>
          {bullets.slice(0, 5).map((item) => (
            <div key={item} className={styles.bulletItem}>
              {item}
            </div>
          ))}
        </div>
      ) : review ? (
        <blockquote className={styles.proofQuote}>{review}</blockquote>
      ) : (
        <EmptyState label="No trustworthy source content was available for this module." />
      )}
      <ActionButtons items={ctas(section, 3)} />
    </div>
  );
}

function ContactDetails({
  mapped,
  section,
  hours,
}: {
  mapped: MappedPagePayload;
  section: MappedSection | undefined;
  hours?: MappedSection;
}) {
  const phones = phoneLines(section);
  const hoursLines = bulletItems(hours);

  return (
    <div className={styles.detailsCard}>
      <p className={styles.sectionEyebrow}>Dealer contact</p>
      <h3 className={styles.cardHeading}>{heading(section, `Visit ${mapped.dealer_name}`)}</h3>
      {addressBlock(section) ? <p className={styles.cardText}>{addressBlock(section)}</p> : null}
      {phones.length > 0 ? (
        <div className={styles.hoursList}>
          {phones.map((line) => (
            <div key={line} className={styles.hoursItem}>
              <span>Phone</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      ) : null}
      {hoursLines.length > 0 ? (
        <div className={styles.hoursList}>
          {hoursLines.slice(0, 5).map((line) => (
            <div key={line} className={styles.hoursItem}>
              <span>Hours</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      ) : null}
      <ActionButtons items={ctas(section, 2)} />
    </div>
  );
}

function AboutTemplate({ mapped }: { mapped: MappedPagePayload }) {
  const intro = getSection(mapped, "intro");
  const story = getSection(mapped, "story_or_history");
  const values = getSection(mapped, "why_buy_or_values");
  const community = getSection(mapped, "community_or_market");
  const awards = getSection(mapped, "reviews_or_awards");
  const footer = getSection(mapped, "contact_footer");

  return (
    <div className={styles.page}>
      <InnerHero mapped={mapped} section={intro} eyebrow="About the dealership" />
      <section className={styles.sectionMuted}>
        <div className={`${styles.container} ${styles.innerGrid}`}>
          <ContentCard eyebrow="History" title="Dealer story and heritage" section={story} />
          <ContentCard eyebrow="Values" title="Why customers choose this store" section={values} />
        </div>
      </section>
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.twoColumn}`}>
          <ContentCard eyebrow="Community" title="Local market presence" section={community} />
          <ContentCard eyebrow="Awards" title="Proof and recognition" section={awards} />
        </div>
      </section>
      <section className={styles.ctaStrip}>
        <div className={styles.container}>
          <h3 className={styles.ctaStripHeading}>Continue the conversation with the dealership</h3>
          <ActionButtons items={ctas(footer, 2)} ghost />
        </div>
      </section>
    </div>
  );
}

function ContactTemplate({ mapped, hoursMode }: { mapped: MappedPagePayload; hoursMode?: boolean }) {
  const intro = getSection(mapped, "intro");
  const departments = getSection(mapped, "department_contacts");
  const address = getSection(mapped, "address_and_map") || getSection(mapped, "contact_hours_map");
  const form = getSection(mapped, "contact_form");
  const directions = getSection(mapped, "directions_cta");
  const hours = getSection(mapped, "hours_table") || getSection(mapped, "hours_linkout_or_embed");

  return (
    <div className={styles.page}>
      <InnerHero mapped={mapped} section={intro} eyebrow={hoursMode ? "Dealer hours" : "Contact page"} />
      <section className={styles.sectionMuted}>
        <div className={`${styles.container} ${styles.innerGrid}`}>
          <ContactDetails mapped={mapped} section={address || departments} hours={hours} />
          <ContentCard eyebrow="Departments" title="Sales, service, and parts contacts" section={departments || directions} />
        </div>
      </section>
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.twoColumn}`}>
          <ContentCard eyebrow="Directions" title="Find the dealership" section={directions || address} />
          <ContentCard eyebrow={hoursMode ? "Hours" : "Contact form"} title={hoursMode ? "Visit planning" : "Request follow-up"} section={hoursMode ? hours : form} />
        </div>
      </section>
    </div>
  );
}

function ServiceTemplate({ mapped }: { mapped: MappedPagePayload }) {
  const intro = getSection(mapped, "intro");
  const schedule = getSection(mapped, "schedule_service_cta");
  const why = getSection(mapped, "why_service_here");
  const capabilities = getSection(mapped, "service_capabilities");
  const support = getSection(mapped, "owner_support_links");
  const specials = getSection(mapped, "service_specials_cta");
  const contact = getSection(mapped, "contact_hours_map");

  return (
    <div className={styles.page}>
      <InnerHero mapped={mapped} section={intro} eyebrow="Service and maintenance" />
      <section className={styles.sectionMuted}>
        <div className={`${styles.container} ${styles.innerGrid}`}>
          <ContentCard eyebrow="Appointment" title="Schedule service" section={schedule} />
          <ContentCard eyebrow="Why service here" title="Why owners come back here" section={why} />
        </div>
      </section>
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.twoColumn}`}>
          <ContentCard eyebrow="Capabilities" title="Maintenance and repair coverage" section={capabilities} />
          <ContentCard eyebrow="Owner support" title="Owner resources and specials" section={support || specials} />
        </div>
      </section>
      <section className={styles.ctaStrip}>
        <div className={styles.container}>
          <h3 className={styles.ctaStripHeading}>Need service help now?</h3>
          <ActionButtons items={ctas(schedule, 1).concat(ctas(contact, 1)).slice(0, 2)} ghost />
        </div>
      </section>
    </div>
  );
}

function FinanceTemplate({ mapped }: { mapped: MappedPagePayload }) {
  const intro = getSection(mapped, "intro");
  const application = getSection(mapped, "finance_application_cta");
  const tools = getSection(mapped, "calculator_and_tools");
  const support = getSection(mapped, "finance_support_copy");
  const trade = getSection(mapped, "trade_support_cta");
  const contact = getSection(mapped, "contact_cta");

  return (
    <div className={styles.page}>
      <InnerHero mapped={mapped} section={intro} eyebrow="Finance center" />
      <section className={styles.sectionMuted}>
        <div className={`${styles.container} ${styles.innerGrid}`}>
          <ContentCard eyebrow="Application" title="Apply for financing" section={application} />
          <ContentCard eyebrow="Support" title="Lease, buy, and approval guidance" section={support} />
        </div>
      </section>
      <section className={styles.section}>
        <div className={`${styles.container} ${styles.twoColumn}`}>
          <ContentCard eyebrow="Tools" title="Calculators and payment tools" section={tools} />
          <ContentCard eyebrow="Trade" title="Trade and upgrade support" section={trade || contact} />
        </div>
      </section>
    </div>
  );
}

function PromoTemplate({ mapped, eyebrow }: { mapped: MappedPagePayload; eyebrow: string }) {
  const intro = getSection(mapped, "intro");
  const sections = mapped.sections.filter((section) => section.slot_key !== "intro");

  return (
    <div className={styles.page}>
      <InnerHero mapped={mapped} section={intro} eyebrow={eyebrow} />
      <section className={styles.sectionMuted}>
        <div className={`${styles.container} ${styles.twoColumn}`}>
          {sections.slice(0, 4).map((section) => (
            <ContentCard key={section.slot_key} eyebrow={section.label} title={section.label} section={section} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ProgramTemplate({ mapped, eyebrow }: { mapped: MappedPagePayload; eyebrow: string }) {
  const intro = getSection(mapped, "intro");
  const sections = mapped.sections.filter((section) => section.slot_key !== "intro");

  return (
    <div className={styles.page}>
      <InnerHero mapped={mapped} section={intro} eyebrow={eyebrow} />
      <section className={styles.sectionMuted}>
        <div className={`${styles.container} ${styles.twoColumn}`}>
          {sections.slice(0, 4).map((section) => (
            <ContentCard key={section.slot_key} eyebrow={section.label} title={section.label} section={section} />
          ))}
        </div>
      </section>
    </div>
  );
}

function renderPreviewByType(mapped: MappedPagePayload) {
  switch (mapped.page_type) {
    case "homepage":
      return <HomepageTemplate mapped={mapped} />;
    case "about":
      return <AboutTemplate mapped={mapped} />;
    case "contact":
      return <ContactTemplate mapped={mapped} />;
    case "hours":
      return <ContactTemplate mapped={mapped} hoursMode />;
    case "service":
      return <ServiceTemplate mapped={mapped} />;
    case "finance":
      return <FinanceTemplate mapped={mapped} />;
    case "specials":
      return <PromoTemplate mapped={mapped} eyebrow="Specials and incentives" />;
    case "trade_appraisal":
      return <PromoTemplate mapped={mapped} eyebrow="Trade appraisal" />;
    case "staff":
      return <ProgramTemplate mapped={mapped} eyebrow="Meet the team" />;
    case "research_model":
      return <ProgramTemplate mapped={mapped} eyebrow="Model research" />;
    case "local_seo_landing":
      return <ProgramTemplate mapped={mapped} eyebrow="Local landing page" />;
    default:
      return <ProgramTemplate mapped={mapped} eyebrow="Template rebuild" />;
  }
}

export function TemplatePreview({
  mapped,
  rebuilt,
  sourceUrl,
  destinationLabel,
  templatePackageId,
  matchedTemplatePath,
}: {
  mapped?: MappedPagePayload;
  rebuilt?: { html: string; templatePath: string; confidence: number };
  sourceUrl: string;
  destinationLabel?: string;
  templatePackageId?: string;
  matchedTemplatePath?: string;
}) {
  const previewMode = choosePreviewMode({
    rebuiltHtml: rebuilt?.html,
    mappedPage: mapped,
    matchedTemplatePath,
  });

  if (previewMode === "package" && rebuilt) {
    return (
      <PackagePreviewFrame
        html={rebuilt.html}
        templatePath={rebuilt.templatePath}
        confidence={rebuilt.confidence}
        destinationLabel={destinationLabel}
        templatePackageId={templatePackageId}
      />
    );
  }

  if (previewMode === "package_pending" && matchedTemplatePath) {
    return <PendingPackagePreview mapped={mapped} templatePath={matchedTemplatePath} />;
  }

  if (previewMode === "empty" || !mapped) {
    return (
      <div className={styles.page}>
        <div className={styles.infoCard}>
          <p className={styles.sectionEyebrow}>Unsupported migration target</p>
          <h3 className={styles.cardHeading}>This page stays visible in review, but it is not rebuilt for v1.</h3>
          <p className={styles.cardText}>
            Inventory search, VDP, checkout, and feed-driven surfaces remain out of scope for the
            static page migration workflow.
          </p>
          <p className={styles.cardText}>{sourceUrl}</p>
        </div>
      </div>
    );
  }

  return renderPreviewByType(mapped);
}
