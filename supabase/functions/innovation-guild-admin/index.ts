import { createClient } from "npm:@supabase/supabase-js@2";
import contactSeedRecords from "./organization-contact-seed.json" with { type: "json" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SELCO_VENDOR_SERVICE_ROLE_KEY") ?? "";
const innovationAuthHeader = Deno.env.get("INNOVATION_GUILD_APP_AUTHORIZATION") ?? "Appkey YXBwS2V5OjVkMDFiZGNlLTVlMjAtNDkxZS1hNDYyLTMxNDMyOTU1ZGIzNCxhcHBDb2RlOkNPTU1PTlNfQVBQLkNIQU5HRU1BS0VS";
const marketUuid = "COMMONS-INNOVATION_GUILD-2024";
const innovationBaseUrl = "https://login.platformcommons.org";
const innovationSiteBaseUrl = "https://innovationguild.in";
let supabaseClient: ReturnType<typeof createClient> | null = null;

type ContactSeedRecord = {
  vendor_id?: string;
  vendor_name?: string;
  website_details?: string;
  portal_vendor_link?: string;
  final_contact_email?: string;
  final_contact_phone?: string;
  final_contact_address?: string;
  website_email?: string;
  website_phone?: string;
  website_address?: string;
  contact_source_url?: string;
  website_status?: string;
  contact_notes?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type InnovationListItem = Record<string, unknown>;
type InnovationDetail = Record<string, unknown>;
type AttachmentRecord = {
  completeURL?: string;
  sequence?: number;
  mimeType?: string;
};

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Function secrets are not configured.");
  if (supabaseClient) return supabaseClient;
  supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return supabaseClient;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function requireString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value: unknown) {
  return requireString(value).toLowerCase();
}

function safeUrl(value: string) {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeLocationValue(value: unknown) {
  return requireString(value)
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*\|\s*/g, " | ")
    .trim();
}

function locationKey(value: unknown) {
  return normalizeLocationValue(value).toLowerCase();
}

function dedupeLocations(values: unknown[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = normalizeLocationValue(value);
    const key = locationKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function mentionsStateCountry(address: string, stateCountry: string) {
  if (!address || !stateCountry) return false;
  return locationKey(address).includes(locationKey(stateCountry));
}

function locationContainedInAddress(address: string, candidate: string) {
  const addressValue = locationKey(address);
  const candidateValue = locationKey(candidate);
  if (!addressValue || !candidateValue) return false;
  if (addressValue === candidateValue || addressValue.endsWith(candidateValue) || addressValue.includes(`, ${candidateValue}`)) return true;
  const parts = candidateValue.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 && parts.every((part) => addressValue.includes(part));
}

function buildVendorCoverageLocations(values: unknown[], primaryAddress: string, state: string, country: string) {
  const cleanedAddress = normalizeLocationValue(primaryAddress);
  const stateCountry = normalizeLocationValue([state, country].filter(Boolean).join(", "));
  return dedupeLocations(values).filter((value) => {
    const key = locationKey(value);
    if (!key) return false;
    if (cleanedAddress && locationContainedInAddress(cleanedAddress, value)) return false;
    if (stateCountry && key === locationKey(stateCountry) && mentionsStateCountry(cleanedAddress, stateCountry)) return false;
    return true;
  });
}

function toNullableNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toUsableCoordinate(value: unknown) {
  const num = toNullableNumber(value);
  if (num === null) return null;
  return Math.abs(num) <= 0.0001 ? null : num;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "-");
}

function decodeHtml(value: unknown): string {
  return requireString(value)
    .replace(/&#160;|&nbsp;/gi, " ")
    .replace(/&#8211;/gi, " - ")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8220;|&#8221;/gi, "\"")
    .replace(/&#10004;|&#128295;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/<\/div>/gi, "\n")
    .replace(/<div[^>]*>/gi, "")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<ul[^>]*>|<\/ul>/gi, "")
    .replace(/<span[^>]*>|<\/span>/gi, "")
    .replace(/<b[^>]*>|<\/b>/gi, "")
    .replace(/<strong[^>]*>|<\/strong>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function normalizeGeocodeQuery(value: string) {
  return requireString(value)
    .replace(/#/g, " ")
    .replace(/\s*-\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function buildGeocodeQueries(address: string, state: string, country: string, locationText: string) {
  const cleanedAddress = normalizeGeocodeQuery(address);
  const cleanedState = normalizeGeocodeQuery(state);
  const cleanedCountry = normalizeGeocodeQuery(country);
  const primaryLocation = normalizeGeocodeQuery(locationText.split("|")[0] || "");
  const queries = [
    [cleanedAddress, cleanedState, cleanedCountry].filter(Boolean).join(", "),
    [primaryLocation, cleanedState, cleanedCountry].filter(Boolean).join(", "),
  ];

  const addressParts = cleanedAddress.split(",").map((part) => part.trim()).filter(Boolean);
  for (let take = Math.min(4, addressParts.length); take >= 2; take -= 1) {
    queries.push([...addressParts.slice(-take), cleanedState, cleanedCountry].filter(Boolean).join(", "));
  }

  queries.push([cleanedState, cleanedCountry].filter(Boolean).join(", "));
  queries.push(cleanedCountry);
  return dedupeLocations(queries);
}

async function geocodeAddressFallback(address: string, state: string, country: string, locationText: string) {
  const queries = buildGeocodeQueries(address, state, country, locationText);
  for (const query of queries) {
    if (!query) continue;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Innovation Guild Directory Sync/1.0",
        },
      });
      if (!response.ok) continue;
      const data = await response.json() as Array<Record<string, unknown>>;
      const match = Array.isArray(data) ? data[0] : null;
      const lat = toUsableCoordinate(match?.lat);
      const lng = toUsableCoordinate(match?.lon);
      if (lat !== null && lng !== null) {
        return { latitude: lat, longitude: lng };
      }
    } catch {
      continue;
    }
  }
  return { latitude: null, longitude: null };
}

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validateSession(token: string) {
  const supabase = getSupabaseAdmin();
  const tokenHash = await hashToken(token);
  const { data, error } = await supabase.from("grameee_admin_sessions").select("id, username, expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await supabase.from("grameee_admin_sessions").delete().eq("id", data.id);
    return null;
  }
  await supabase.from("grameee_admin_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data;
}

async function verifyAdminPassword(username: string, password: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("grameee_admin_password_matches", { p_username: username, p_password: password });
  if (error) throw new Error(`Admin password verification failed: ${error.message}`);
  return Boolean(data);
}

async function handleLogin(password: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("grameee_admin_accounts").select("username, password_hash").eq("username", "admin").maybeSingle();
  if (error) return errorResponse(`Admin account lookup failed: ${error.message}`, 500);
  if (!data?.password_hash) return errorResponse("Admin account does not exist yet.", 401);
  const validPassword = await verifyAdminPassword("admin", password).catch(() => false);
  if (!validPassword) return errorResponse("Invalid admin password.", 401);

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("grameee_admin_sessions").delete().eq("username", "admin");
  const { error: sessionError } = await supabase.from("grameee_admin_sessions").insert({ username: "admin", token_hash: tokenHash, expires_at: expiresAt });
  if (sessionError) return errorResponse("Admin session could not be created.", 500);
  return jsonResponse({ token, username: "admin", expires_at: expiresAt });
}

async function handleVerify(token: string) {
  const session = await validateSession(token);
  return jsonResponse({ valid: Boolean(session), username: session?.username ?? null, expires_at: session?.expires_at ?? null });
}

async function handleLogout(token: string) {
  const supabase = getSupabaseAdmin();
  const tokenHash = await hashToken(token);
  await supabase.from("grameee_admin_sessions").delete().eq("token_hash", tokenHash);
  return jsonResponse({ ok: true });
}

function innovationHeaders() {
  return {
    Authorization: innovationAuthHeader,
    Referer: `${innovationSiteBaseUrl}/`,
    Accept: "application/json, text/plain, */*",
    "User-Agent": "Innovation Guild Directory/1.0",
  };
}

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: innovationHeaders() });
  if (!response.ok) throw new Error(`Fetch failed for ${url}: ${response.status}`);
  return await response.json();
}

async function fetchInnovationList() {
  const response = await fetchJson(`${innovationBaseUrl}/gateway/commons-search-service/api/v1/opportunities/change-maker/filter?page=0&fetchBasedOnRole=false&opportunityTypes=OPPORTUNITY_TYPE.INNOVATION&marketUUID=${encodeURIComponent(marketUuid)}&facetFields=opportunityCauseList&fetch=FETCH_TYPE.LATEST&size=500`);
  return Array.isArray((response as Record<string, unknown>).elements) ? (response as Record<string, unknown>).elements as InnovationListItem[] : [];
}

async function fetchInnovationDetail(id: string) {
  return await fetchJson(`${innovationBaseUrl}/gateway/commons-opportunity-service/api/v1/opportunities?id=${encodeURIComponent(id)}`) as InnovationDetail;
}

async function fetchAttachments(id: string, entityType: string) {
  const data = await fetchJson(`${innovationBaseUrl}/gateway/commons-opportunity-service/api/v1/attachments/bulk/public?entityIds=${encodeURIComponent(id)}&entityType=${encodeURIComponent(entityType)}`) as Record<string, AttachmentRecord[]>;
  return Array.isArray(data[id]) ? data[id] : [];
}

function getLocationEntries(detail: InnovationDetail) {
  return Array.isArray(detail.opportunityLocationList) ? detail.opportunityLocationList as Record<string, unknown>[] : [];
}

function getEntityLocation(detail: InnovationDetail) {
  return getLocationEntries(detail).find((entry) => requireString(entry.type) === "LOCATION_TYPE.ENT_LOCATION") || null;
}

function buildLocations(detail: InnovationDetail) {
  const locations = getLocationEntries(detail);
  const entity = getEntityLocation(detail);
  const sales = locations.filter((entry) => requireString(entry.type) === "LOCATION_TYPE.SALES_LOCATIONS").map((entry) => [requireString(entry.stateLabel), requireString(entry.countryLabel)].filter(Boolean).join(", "));
  const manufactured = locations.filter((entry) => requireString(entry.type) === "LOCATION_TYPE.INNOVATION_MANUFACTURED").map((entry) => [requireString(entry.stateLabel), requireString(entry.countryLabel)].filter(Boolean).join(", "));
  return dedupeLocations([
    normalizeLocationValue(entity?.addressLine1),
    ...sales,
    ...manufactured,
    [requireString(entity?.stateLabel), requireString(entity?.countryLabel)].filter(Boolean).join(", "),
  ]);
}

function buildProductSpecifications(detail: InnovationDetail) {
  const extraAttributes = Array.isArray(detail.extraAttributeSet) ? detail.extraAttributeSet as Record<string, unknown>[] : [];
  return extraAttributes.map((entry) => {
    const metaDataCode = entry.metaDataCode as Record<string, unknown> | undefined;
    const attributeValueCode = entry.attributeValueCode as Record<string, unknown> | undefined;
    const attributeValues = Array.isArray(entry.attributeValues) ? entry.attributeValues as unknown[] : [];
    return {
      key: decodeHtml(metaDataCode?.name || metaDataCode?.code || "Specification"),
      value: decodeHtml(entry.attributeValueText || attributeValueCode?.name || attributeValueCode?.code || attributeValues.join(", ") || "Not listed"),
    };
  }).filter((item) => item.key && item.value);
}

function extractVideoUrls(attachments: AttachmentRecord[]) {
  const urls = attachments.map((entry) => requireString(entry.completeURL)).filter(Boolean);
  return urls.map((url) => {
    const youtubeId = url.match(/youtube\.com\/shorts\/([^?&#/]+)/i)?.[1]
      || url.match(/youtube\.com\/watch\?v=([^?&#/]+)/i)?.[1]
      || url.match(/youtu\.be\/([^?&#/]+)/i)?.[1]
      || url.match(/youtube\.com\/embed\/([^?&#/]+)/i)?.[1];
    if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}`;
    const vimeoId = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1];
    if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
    const loomId = url.match(/loom\.com\/(?:share|embed)\/([^?&#/]+)/i)?.[1];
    if (loomId) return `https://www.loom.com/embed/${loomId}`;
    return /\.mp4($|\?)/i.test(url) ? url : "";
  }).filter(Boolean);
}

function extractImageUrls(detail: InnovationDetail, attachments: AttachmentRecord[]) {
  const iconPic = requireString(detail.iconPic);
  const attachmentImages = attachments
    .map((entry) => requireString(entry.completeURL))
    .filter((url) => /^https?:\/\//i.test(url) && !/youtube|youtu\.be|vimeo|loom/i.test(url));
  return dedupe([iconPic, ...attachmentImages]);
}

function buildVendorId(detail: InnovationDetail, fallbackName: string) {
  const orgDetails = detail.opportunityOrgDetails as Record<string, unknown> | undefined;
  return requireString(orgDetails?.organisationCode) || `innovation-guild-${slugify(fallbackName)}`;
}

function getSeedMap() {
  const byId = new Map<string, ContactSeedRecord>();
  const byName = new Map<string, ContactSeedRecord>();
  for (const record of contactSeedRecords as ContactSeedRecord[]) {
    const id = requireString(record.vendor_id);
    const name = normalizeText(record.vendor_name);
    if (id) byId.set(id, record);
    if (name && !byName.has(name)) byName.set(name, record);
  }
  return { byId, byName };
}

function mergeContactDetails(seed: ContactSeedRecord | undefined, derivedAddress: string, sourceUrl: string) {
  const websiteDetails = safeUrl(requireString(seed?.website_details));
  return {
    websiteDetails: websiteDetails || null,
    websiteEmail: requireString(seed?.website_email) || null,
    websitePhone: requireString(seed?.website_phone) || null,
    websiteAddress: requireString(seed?.website_address) || null,
    finalEmail: requireString(seed?.final_contact_email) || null,
    finalPhone: requireString(seed?.final_contact_phone) || null,
    finalAddress: requireString(seed?.final_contact_address) || derivedAddress || null,
    contactSourceUrl: requireString(seed?.contact_source_url) || sourceUrl || null,
    websiteStatus: requireString(seed?.website_status) || (websiteDetails ? "Seed website listed" : "Innovation Guild API does not expose website/email/phone"),
    contactNotes: requireString(seed?.contact_notes) || "Address captured from Innovation Guild. Email and phone can be enriched via organization-contact-seed.json when available.",
    latitude: toUsableCoordinate(seed?.latitude),
    longitude: toUsableCoordinate(seed?.longitude),
    portalVendorLink: safeUrl(requireString(seed?.portal_vendor_link)) || "",
  };
}

async function mapLimit<T, R>(items: T[], batchSize: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map((item) => worker(item)));
    results.push(...batchResults);
  }
  return results;
}

async function upsertInBatches(table: string, rows: Record<string, unknown>[], onConflict: string, batchSize: number) {
  const supabase = getSupabaseAdmin();
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    if (!batch.length) continue;
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function handleListInnovationSyncRuns(token: string) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  const { data, error } = await supabase.from("innovation_guild_sync_runs").select("*").order("created_at", { ascending: false }).limit(10);
  if (error) return errorResponse("Innovation Guild sync runs could not be loaded.", 500);
  return jsonResponse({ items: data ?? [] });
}

async function handleSyncInnovationGuildDirectory(token: string) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);

  const { data: runData, error: runError } = await supabase.from("innovation_guild_sync_runs").insert({ status: "running", requested_by: session.username, started_at: new Date().toISOString() }).select("id").single();
  if (runError || !runData?.id) return errorResponse("Innovation Guild sync run could not be created.", 500);
  const runId = String(runData.id);

  try {
    const seedMap = getSeedMap();
    const listItems = await fetchInnovationList();
    const detailedItems = await mapLimit(listItems, 8, async (listItem) => {
      const id = requireString(listItem.id);
      const detail = await fetchInnovationDetail(id);
      const [gallery, designGallery, resources] = await Promise.all([
        fetchAttachments(id, "ENTITY_TYPE.OPPORTUNITY_GALLERY"),
        fetchAttachments(id, "ENTITY_TYPE.OPPORTUNITY_DESIGN_GALLERY"),
        fetchAttachments(id, "ENTITY_TYPE.OPPORTUNITY_RESOURCES"),
      ]);
      return { listItem, detail, attachments: [...gallery, ...designGallery, ...resources].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0)) };
    });

    const productRows = detailedItems.map(({ listItem, detail, attachments }) => {
      const orgDetails = detail.opportunityOrgDetails as Record<string, unknown> | undefined;
      const vendorName = decodeHtml(orgDetails?.organisationName || listItem.organisationName || detail.tenantName || "Unknown Organization");
      const vendorId = buildVendorId(detail, vendorName);
      const productCategories = dedupe((Array.isArray(detail.opportunityCategorySet) ? detail.opportunityCategorySet : []).map((entry) => decodeHtml((entry as Record<string, unknown>)?.categoryCode && ((entry as Record<string, unknown>).categoryCode as Record<string, unknown>).name)));
      const productSubcategories = dedupe((Array.isArray(detail.opportunitySubCategorySet) ? detail.opportunitySubCategorySet : []).map((entry) => decodeHtml((entry as Record<string, unknown>)?.subCategoryCode && ((entry as Record<string, unknown>).subCategoryCode as Record<string, unknown>).name)));
      const productTags = dedupe([
        ...(Array.isArray(detail.tagSet) ? detail.tagSet : []).map((entry) => decodeHtml((entry as Record<string, unknown>)?.code && ((entry as Record<string, unknown>).code as Record<string, unknown>).name)),
        ...productCategories,
        ...productSubcategories,
      ]);
      const specifications = buildProductSpecifications(detail);
      const locations = buildLocations(detail);
      const productGalleryUrls = extractImageUrls(detail, attachments);
      const productVideoUrls = dedupe(extractVideoUrls(attachments));
      return {
        portal_product_id: requireString(detail.id || listItem.id),
        portal_vendor_id: vendorId,
        vendor_name: vendorName,
        product_name: decodeHtml(detail.title || listItem.title || "Untitled Machine"),
        product_description: decodeHtml(detail.longDescription || listItem.longDescription) || null,
        product_link: `${innovationSiteBaseUrl}/innovation/${requireString(detail.id || listItem.id)}/${slugify(decodeHtml(detail.title || listItem.title || "innovation"))}`,
        product_image_url: requireString(detail.iconPic) || productGalleryUrls[0] || null,
        product_gallery_urls: productGalleryUrls,
        product_video_urls: productVideoUrls,
        product_location_text: locations.join(" | ") || null,
        product_categories: productCategories,
        product_subcategories: productSubcategories,
        product_specifications: specifications,
        tags: productTags,
        search_text: dedupe([
          decodeHtml(detail.title || listItem.title),
          decodeHtml(detail.longDescription || listItem.longDescription),
          ...productTags,
          ...productCategories,
          ...productSubcategories,
          ...locations,
          ...specifications.flatMap((spec) => [spec.key, spec.value]),
        ]).join(" "),
        raw_product: {
          listItem,
          detail,
          attachments,
        },
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }).filter((row) => row.portal_product_id && row.portal_vendor_id);

    const rawVendorRows = uniqueBy(productRows.map((product) => {
      const detail = product.raw_product.detail as InnovationDetail;
      const orgDetails = detail.opportunityOrgDetails as Record<string, unknown> | undefined;
      const vendorId = product.portal_vendor_id;
      const vendorName = product.vendor_name;
      const seed = seedMap.byId.get(vendorId) || seedMap.byName.get(normalizeText(vendorName));
      const entityLocation = getEntityLocation(detail);
      const linkedProducts = productRows.filter((entry) => entry.portal_vendor_id === vendorId);
      const state = normalizeLocationValue(entityLocation?.stateLabel) || null;
      const country = normalizeLocationValue(entityLocation?.countryLabel) || null;
      const rawVendorLocations = linkedProducts.flatMap((entry) => {
        const productDetail = entry.raw_product.detail as InnovationDetail;
        return buildLocations(productDetail);
      });
      const fallbackAddress = dedupeLocations(rawVendorLocations)[0] || "";
      const derivedAddress = normalizeLocationValue(entityLocation?.addressLine1) || fallbackAddress;
      const mergedContacts = mergeContactDetails(seed, derivedAddress, product.product_link || `${innovationSiteBaseUrl}/innovation/home`);
      const lat = mergedContacts.latitude ?? toUsableCoordinate(entityLocation?.latitude);
      const lng = mergedContacts.longitude ?? toUsableCoordinate(entityLocation?.longitude);
      const finalAddress = normalizeLocationValue(mergedContacts.finalAddress) || null;
      const serviceLocations = buildVendorCoverageLocations(rawVendorLocations, finalAddress || derivedAddress, state || "", country || "");
      const locationText = dedupeLocations([
        finalAddress || derivedAddress,
        ...serviceLocations,
      ]).join(" | ");
      return {
        portal_vendor_id: vendorId,
        vendor_name: vendorName,
        about_vendor: decodeHtml(orgDetails?.organisationDescription || detail.longDescription) || null,
        website_details: mergedContacts.websiteDetails,
        location_text: locationText || null,
        city: null,
        state,
        country,
        service_locations: serviceLocations,
        tags: dedupe(linkedProducts.flatMap((entry) => [...(entry.tags || []), ...(entry.product_categories || []), ...(entry.product_subcategories || [])])),
        portal_vendor_link: mergedContacts.portalVendorLink || `${innovationSiteBaseUrl}/innovation/home`,
        portal_contact_name: vendorName,
        portal_email: null,
        portal_phone: null,
        website_email: mergedContacts.websiteEmail,
        website_phone: mergedContacts.websitePhone,
        website_address: mergedContacts.websiteAddress,
        final_contact_email: mergedContacts.finalEmail,
        final_contact_phone: mergedContacts.finalPhone,
        final_contact_address: finalAddress,
        contact_source_url: mergedContacts.contactSourceUrl,
        website_status: mergedContacts.websiteStatus,
        legacy_products_links: linkedProducts.map((entry) => entry.product_link).filter(Boolean).join("\n"),
        contact_notes: mergedContacts.contactNotes,
        latitude: lat,
        longitude: lng,
        products_count: linkedProducts.length,
        search_text: dedupe([
          vendorName,
          decodeHtml(orgDetails?.organisationDescription),
          locationText,
          mergedContacts.finalAddress || "",
          mergedContacts.finalEmail || "",
          mergedContacts.finalPhone || "",
          ...linkedProducts.flatMap((entry) => [entry.product_name, entry.product_description || "", ...(entry.tags || []), ...(entry.product_categories || []), ...(entry.product_subcategories || [])]),
        ]).join(" "),
        raw_vendor: {
          organization: orgDetails || {},
          sample_product: detail,
        },
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }), (row) => requireString(row.portal_vendor_id));

    const vendorRows = await mapLimit(rawVendorRows, 6, async (row) => {
      const lat = toUsableCoordinate(row.latitude);
      const lng = toUsableCoordinate(row.longitude);
      if (lat !== null && lng !== null) {
        return {
          ...row,
          latitude: lat,
          longitude: lng,
        };
      }
      const geocoded = await geocodeAddressFallback(
        requireString(row.final_contact_address),
        requireString(row.state),
        requireString(row.country),
        requireString(row.location_text),
      );
      return {
        ...row,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
      };
    });

    await upsertInBatches("innovation_guild_vendors", vendorRows, "portal_vendor_id", 100);
    await upsertInBatches("innovation_guild_products", productRows, "portal_product_id", 100);

    await supabase.from("innovation_guild_sync_runs").update({
      status: "success",
      finished_at: new Date().toISOString(),
      vendor_count: vendorRows.length,
      product_count: productRows.length,
      updated_at: new Date().toISOString(),
    }).eq("id", runId);

    return jsonResponse({ ok: true, vendorCount: vendorRows.length, productCount: productRows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Innovation Guild directory sync failed.";
    await supabase.from("innovation_guild_sync_runs").update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: message,
      updated_at: new Date().toISOString(),
    }).eq("id", runId);
    return errorResponse(message, 500);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("Method not allowed.", 405);
  if (!supabaseUrl || !serviceRoleKey) return errorResponse("Function secrets are not configured.", 500);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return errorResponse("Invalid JSON body.", 400); }

  const action = requireString(body.action);
  const token = requireString(body.token);
  const password = requireString(body.password);

  switch (action) {
    case "login":
      return await handleLogin(password);
    case "verify":
      return await handleVerify(token);
    case "logout":
      return await handleLogout(token);
    case "listInnovationSyncRuns":
      return await handleListInnovationSyncRuns(token);
    case "syncInnovationGuildDirectory":
      return await handleSyncInnovationGuildDirectory(token);
    default:
      return errorResponse("Unknown admin action.", 400);
  }
});
