const { pool } = require("../config/db");

async function create({ relatedType, relatedId, fileName, fileUrl, fileType, uploadedBy }) {
  const [result] = await pool.query(
    `
      INSERT INTO attachment
        (related_type, related_id, file_name, file_url, file_type, uploaded_by)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `,
    [relatedType, relatedId, fileName, fileUrl, fileType, uploadedBy],
  );

  return result.insertId;
}

module.exports = { create };
