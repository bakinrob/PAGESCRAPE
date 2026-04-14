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

function buildTemplatePackageAssetHref(packageId: string, assetPath: string) {
  const encodedSegments = normalizeTemplatePath(assetPath).map((segment) => encodeURIComponent(segment));
  return `/api/template-packages/${encodeURIComponent(packageId)}/files/${encodedSegments.join("/")}`;
}

export function rewriteTemplatePackageRootRelativeUrls(html: string, packageId: string) {
  const attributePattern = /((?:src|href)=["'])\/(?!\/)([^"']+)(["'])/gi;
  const cssPattern = /url\((['"]?)\/(?!\/)([^'")]+)\1\)/gi;

  return html
    .replace(attributePattern, (_match, prefix: string, assetPath: string, suffix: string) => {
      return `${prefix}${buildTemplatePackageAssetHref(packageId, assetPath)}${suffix}`;
    })
    .replace(cssPattern, (_match, quote: string, assetPath: string) => {
      const normalizedQuote = quote || "";
      return `url(${normalizedQuote}${buildTemplatePackageAssetHref(packageId, assetPath)}${normalizedQuote})`;
    });
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

export function prepareTemplatePackagePreviewDocument(
  html: string,
  input: { packageId: string; templatePath: string },
) {
  const rewritten = rewriteTemplatePackageRootRelativeUrls(html, input.packageId);
  return injectTemplatePackageBase(
    rewritten,
    buildTemplatePackageBaseHref(input.packageId, input.templatePath),
  );
}
