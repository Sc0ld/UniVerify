# UniVerify

**UniVerify** is a simple certificate verification system where universities upload PDF certificates, and users can verify them by uploading the same file. The system uses **MD5** hashes to validate certificate authenticity.

## Features

- **University Upload**: Upload a certificate PDF with metadata (student name, degree, issue date).
- **User Verification**: Upload a PDF to verify if it matches a stored certificate.
- **Local Storage**: Data is stored in a `certificates.json` file, and PDFs are stored in the `uploads/` folder.

## Setup

1. Clone the repository:

    ```bash
    git clone https://github.com/sc0ld/UniVerify.git
    cd UniVerify
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Create `.env` file in the root directory and add:

    ```env
    ADMIN_TOKEN=your-secret-token
    PORT=3000
    ```

4. Start the server:

    ```bash
    npm start
    ```

The server will be running at `http://localhost:3000`.

## Pages

- **University Upload**: `/university.html`
- **User Verification**: `/verify.html`

## Acknowledgments

- Inspired by the [Watheeq Project](https://x.com/FahadCoding).

---
