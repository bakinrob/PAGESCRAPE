function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function normalizeTemplatePath(templatePath: string) {
  return templatePath
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..");
}

export function buildTemplatePackageBaseHref(packageId: string, templatePath: string) {
  const normalizedPath = normalizeTemplatePath(templatePath);
  const directorySegments = normalizedPath.slice(0, -1).map((segment) => encodeURIComponent(segment));
  const directoryPath = directorySegments.length > 0 ? `/${directorySegments.join("/")}` : "";
  return `/api/template-packages/${encodeURIComponent(packageId)}/files${directoryPath}/`;
}

export function injectTemplatePackageBase(html: string, baseHref: string) {
  if (!baseHref || /<base\s/i.test(html)) {
    return html;
  }

  const baseTag = `<base href="${escapeAttribute(baseHref)}">`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }

  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
  }

  return `<!doctype html><html><head>${baseTag}</head><body>${html}</body></html>`;
}
