// Runs before every test file: marks the process as a test run.
process.env.NODE_ENV = "test";
// Tests never touch a real Cloudinary account, whatever .env says.
process.env.CLOUDINARY_URL = "";
