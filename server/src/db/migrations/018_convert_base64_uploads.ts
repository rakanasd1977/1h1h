const { db, run, all, get } = require('../index');

module.exports = {
  name: "018_convert_base64_uploads",
  up: () => {
    const { convertBase64Value } = require("../../utils/uploads");
    // تحويل الصور المضمّنة بصيغة data:base64 إلى مسارات مخزّنة على القرص.
    // أي قيمة تالفة تُترك كما هي (مع تحذير) دون إيقاف الترحيل.
    const convert = (v) => {
      try {
        return convertBase64Value(v);
      } catch (e: any) {
        console.warn(`[migrate 018] تخطي صورة تالفة (تُترك كما هي): ${e.message}`);
        return v;
      }
    };

    const singleCols = [
      ["providers", "logo"],
      ["providers", "cover"],
      ["providers", "national_id_image"],
      ["providers", "residency_doc_image"],
      ["recharge_requests", "proof_image"],
      ["users", "avatar"],
      ["promotions", "item_image"],
    ];
    for (const [table, col] of singleCols) {
      for (const row of all(`SELECT id, ${col} AS v FROM ${table} WHERE ${col} LIKE 'data:image/%'`)) {
        const next = convert(row.v);
        if (next !== row.v) run(`UPDATE ${table} SET ${col} = ? WHERE id = ?`, [next, row.id]);
      }
    }

    for (const table of ["products", "menu_items", "hotel_rooms", "travel_packages"]) {
      for (const row of all(`SELECT id, images_json AS v FROM ${table} WHERE images_json LIKE '%data:image/%'`)) {
        const next = convert(row.v);
        if (next !== row.v) run(`UPDATE ${table} SET images_json = ? WHERE id = ?`, [next, row.id]);
      }
    }
  },
};