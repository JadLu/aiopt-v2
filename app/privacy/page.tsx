export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px", lineHeight: 1.8, color: "#333", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 32, marginBottom: 30, color: "#000" }}>Privacy Policy</h1>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 30 }}>Last updated: June 2026</p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 15, color: "#000" }}>1. Introduction</h2>
        <p>
          AIOPT ("we," "us," "our," or "Company") operates the AIOPT application ("App"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our App.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 15, color: "#000" }}>2. Information We Collect</h2>
        <h3 style={{ fontSize: 16, marginBottom: 10, marginTop: 15 }}>2.1 Account Information</h3>
        <p>When you create an account, we collect: email address, name, and account credentials.</p>

        <h3 style={{ fontSize: 16, marginBottom: 10, marginTop: 15 }}>2.2 Project Data</h3>
        <p>You provide information about your products and projects, including descriptions, target markets, and performance goals.</p>

        <h3 style={{ fontSize: 16, marginBottom: 10, marginTop: 15 }}>2.3 Meta Account Information</h3>
        <p>
          When you connect your Meta (Facebook) account to use advertising features, we collect your Meta access token and related account data. This allows us to manage your campaigns and retrieve performance metrics on your behalf.
        </p>

        <h3 style={{ fontSize: 16, marginBottom: 10, marginTop: 15 }}>2.4 Usage Data</h3>
        <p>We automatically collect information about your interactions with the App, including IP address, browser type, pages visited, and timestamps.</p>

        <h3 style={{ fontSize: 16, marginBottom: 10, marginTop: 15 }}>2.5 Generated Content</h3>
        <p>
          AI-generated marketing plans, creative assets, landing pages, and video content created through our service are stored to support your projects.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 15, color: "#000" }}>3. How We Use Your Information</h2>
        <ul style={{ marginLeft: 20 }}>
          <li>Provide, maintain, and improve the App and our services</li>
          <li>Generate marketing plans and creative content tailored to your projects</li>
          <li>Manage your Meta ad campaigns and retrieve performance data</li>
          <li>Process credit transactions for content generation</li>
          <li>Communicate with you about your account and service updates</li>
          <li>Comply with legal obligations</li>
          <li>Prevent fraud and ensure security</li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 15, color: "#000" }}>4. Third-Party Services</h2>
        <p>We use the following third-party services:</p>
        <ul style={{ marginLeft: 20 }}>
          <li><strong>Firebase:</strong> For user authentication, data storage, and database management</li>
          <li><strong>Meta (Facebook):</strong> For OAuth authentication and ad campaign management</li>
          <li><strong>Cloudinary:</strong> For image storage and optimization</li>
          <li><strong>KIE AI:</strong> For generating marketing plans, creative assets, and landing pages</li>
        </ul>
        <p style={{ marginTop: 15 }}>
          These services have their own privacy policies. We recommend reviewing them to understand how they process your data.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 15, color: "#000" }}>5. Data Security</h2>
        <p>
          We implement industry-standard security measures to protect your information, including encryption, secure authentication, and access controls. However, no method of transmission over the internet is 100% secure.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 15, color: "#000" }}>6. Data Retention</h2>
        <p>
          We retain your personal data as long as your account is active or as necessary to provide services. You can request deletion of your account and associated data at any time by contacting us.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 15, color: "#000" }}>7. Your Rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul style={{ marginLeft: 20 }}>
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Withdraw consent for data processing</li>
          <li>Export your data in a portable format</li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 15, color: "#000" }}>8. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or our privacy practices, please contact us at:
        </p>
        <p style={{ marginTop: 10 }}>
          <strong>Email:</strong> support@aiopt.app<br />
          <strong>Website:</strong> https://aiopt-v2.vercel.app
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 15, color: "#000" }}>9. Changes to This Privacy Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
        </p>
      </section>

      <div style={{ marginTop: 60, paddingTop: 30, borderTop: "1px solid #ddd", fontSize: 12, color: "#999" }}>
        <p>© 2026 AIOPT. All rights reserved.</p>
      </div>
    </div>
  );
}
