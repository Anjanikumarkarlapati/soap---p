-- Fix currency column type: change from CHAR(3) to VARCHAR(3) to match Hibernate expectations.
ALTER TABLE payments ALTER COLUMN currency TYPE VARCHAR(3);
