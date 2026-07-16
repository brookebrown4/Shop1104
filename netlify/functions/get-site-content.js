// netlify/functions/get-site-content.cjs
//
// Public, read-only. Returns everything the public site needs to render:
// settings, hero, about text, gallery, thread colors, font styles, font
// packages, and design files. Called once when the site loads.

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const [
      { data: contentRows, error: contentErr },
      { data: gallery, error: galleryErr },
      { data: threads, error: threadsErr },
      { data: fonts, error: fontsErr },
      { data: fontPackages, error: fontPackagesErr },
      { data: designs, error: designsErr },
    ] = await Promise.all([
      supabase.from("site_content").select("key, value"),
      supabase.from("gallery_items").select("*").order("sort_order", { ascending: true }),
      supabase.from("thread_colors").select("*").order("sort_order", { ascending: true }),
      supabase.from("font_styles").select("*").order("sort_order", { ascending: true }),
      supabase.from("font_packages").select("*").order("sort_order", { ascending: true }),
      supabase.from("design_files").select("*").order("sort_order", { ascending: true }),
    ]);

    const firstError = contentErr || galleryErr || threadsErr || fontsErr || fontPackagesErr || designsErr;
    if (firstError) {
      console.error("Supabase error (get-site-content):", firstError);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not load site content." }) };
    }

    const contentMap = {};
    (contentRows || []).forEach((row) => {
      contentMap[row.key] = row.value;
    });

    // Map DB snake_case -> the camelCase shape the frontend already uses.
    const mapGallery = (rows) =>
      (rows || []).map((r) => ({
        id: r.id,
        label: r.label,
        bg: r.bg,
        title: r.title,
        desc: r.description,
        image: r.image_data || "",
      }));

    const mapThreads = (rows) => (rows || []).map((r) => ({ id: r.id, name: r.name, code: r.code, hex: r.hex }));

    const mapFonts = (rows) =>
      (rows || []).map((r) => ({
        id: r.id,
        name: r.name,
        sample: r.sample,
        cssFamily: r.css_family,
        cssExtra: r.css_extra,
        desc: r.description,
      }));

    const mapFontPackages = (rows) =>
      (rows || []).map((r) => ({
        id: r.id,
        name: r.name,
        desc: r.description,
        resourceUrl: r.resource_url,
        resourceLabel: r.resource_label,
      }));

    const mapDesigns = (rows) => (rows || []).map((r) => ({ id: r.id, name: r.name, category: r.category, files: r.files }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        settings: contentMap.settings || null,
        hero: contentMap.hero || null,
        about: contentMap.about || null,
        gallery: mapGallery(gallery),
        threads: mapThreads(threads),
        fonts: mapFonts(fonts),
        fontPackages: mapFontPackages(fontPackages),
        designs: mapDesigns(designs),
      }),
    };
  } catch (err) {
    console.error("get-site-content error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load site content." }) };
  }
};
