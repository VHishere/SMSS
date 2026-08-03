INSERT INTO user_role (user_id, role_id)
SELECT DISTINCT
  t.user_id,
  (
    SELECT role_id
    FROM role
    WHERE role_name = 'HOMEROOM_TEACHER'
  )
FROM teacher_class tc
JOIN teacher t ON t.teacher_id = tc.teacher_id
WHERE tc.role_in_class = 'HOMEROOM_TEACHER'
  AND NOT EXISTS (
    SELECT 1
    FROM user_role ur
    JOIN role r ON r.role_id = ur.role_id
    WHERE ur.user_id = t.user_id
      AND r.role_name = 'HOMEROOM_TEACHER'
  );

CREATE TABLE IF NOT EXISTS notification_read_state (
  user_id BIGINT NOT NULL,
  feed_key VARCHAR(100) NOT NULL,
  read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, feed_key),
  KEY idx_nrs_user (user_id),
  CONSTRAINT fk_nrs_user FOREIGN KEY (user_id)
    REFERENCES user_account (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
