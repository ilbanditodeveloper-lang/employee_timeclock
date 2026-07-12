/** Legal & misc UI strings — merged into en catalog */
export const legalExt = {
  legal: {
    common: {
      disclaimerShort:
        "Informational template — must be reviewed by legal counsel before commercial use.",
      disclaimerDpa:
        "Guidance template — requires review by legal counsel/payroll advisor/DPO before official use. Must be formalized between the TimeClock provider and each client company.",
      backToHome: "Back to home",
      privacyPolicy: "Privacy policy",
      termsOfUse: "Terms of use",
      versionLabel: "Version {{version}}",
      readDocument: "Read document",
      copy: "Copy",
      pdf: "PDF",
      templateVersion: "Template version: {{version}}",
      copySuccess: "Text copied to clipboard",
      copyFailed: "Could not copy",
      pdfDownloaded: "PDF downloaded",
    },
    platform: {
      privacy: {
        title: "TimeClock platform privacy policy",
        lastUpdated: "Last updated: June 22, 2026",
        sections: {
          controller: {
            title: "1. Controller and processor",
            body: "Each client company is the data controller for its employees' data. The TimeClock platform acts as data processor by providing the technical time-tracking tool.",
          },
          data: {
            title: "2. Data processed by the platform",
            bullet1: "Identification: name, username, phone (optional).",
            bullet2: "Employment data: schedules, clock-ins, incidents, leave requests.",
            bullet3: "Location at clock-in (only if enabled by the company).",
            bullet4: "Minimal technical data: push subscription, audit logs.",
          },
          purpose: {
            title: "3. Purpose and legal basis",
            body: "Time tracking and working-hours management. The main legal basis is the employer's legal obligation (Art. 34.9 Spanish Workers' Statute) and performance of the employment relationship — not employee consent as the primary basis.",
          },
          retention: {
            title: "4. Retention",
            body: "Time records are kept for at least 4 years. Other data while the company relationship or service contract exists.",
          },
          recipients: {
            title: "5. Recipients",
            body: "Employer, authorized workers, labor advisors if applicable, Labor Inspectorate when requested, and technical providers (PostgreSQL hosting, push notifications, maps if configured).",
          },
          rights: {
            title: "6. Rights",
            body: "Access, rectification, erasure, objection, restriction, and portability where applicable. Contact your company's controller (details in the business legal section) or platform support.",
          },
          security: {
            title: "7. Security",
            body: "Secure password hashing, HTTPS in production, multi-tenant isolation, audit logging for clock-in corrections.",
          },
        },
      },
      terms: {
        title: "Terms of use for companies",
        sections: {
          object: {
            title: "1. Purpose",
            body: "TimeClock is a SaaS technical tool for time tracking. The using company is responsible for legal compliance toward its workers.",
          },
          obligations: {
            title: "2. Company obligations",
            bullet1: "Inform employees about data processing.",
            bullet2: "Correctly configure legal data (tax ID, privacy contact).",
            bullet3: "Retain and export time records for 4 years.",
            bullet4: "Do not use the app for non-work purposes or invasive surveillance.",
          },
          liability: {
            title: "3. Limitation of liability",
            body: "The platform provides infrastructure and software. It does not replace legal advice nor guarantee regulatory compliance on its own without proper configuration and use.",
          },
          data: {
            title: "4. Data and cancellation",
            body: "Before deleting a company account, export records. Clock-ins may be subject to a minimum 4-year legal retention period.",
          },
        },
      },
      dpa: {
        title: "Data processing agreement (GDPR Art. 28)",
        platform: "Platform: TimeClock",
        sections: {
          object: {
            title: "1. Purpose",
            body: "Processing of client company employees' personal data for time tracking and working-hours management via the TimeClock SaaS platform.",
          },
          duration: {
            title: "2. Duration",
            body: "For the term of the SaaS service contract between the parties.",
          },
          dataTypes: {
            title: "3. Data types and data subjects",
            bullet1: "Employment identification data: name, username, phone (optional).",
            bullet2: "Time records: clock-ins, clock-outs, schedules, incidents, absences.",
            bullet3: "Location at clock-in (only if enabled by the company).",
            bullet4: "Technical data: change audit, push subscriptions.",
          },
          obligations: {
            title: "4. Processor obligations",
            bullet1: "Process only per documented instructions from the controller (client company).",
            bullet2: "Confidentiality of authorized personnel.",
            bullet3: "Appropriate technical and organizational security measures.",
            bullet4: "Sub-processors (hosting, notifications) with equivalent guarantees.",
            bullet5: "Assist the controller with data subject rights.",
            bullet6: "Delete or return data on termination, except where legal retention applies.",
          },
          security: {
            title: "5. Security measures",
            body: "Multi-tenant isolation, HTTPS, password hashing, audit of clock-in corrections, database provider backups.",
          },
          contact: {
            title: "6. Contact",
            body: "To formalize this agreement or request information, contact TimeClock platform support or your service provider.",
          },
        },
      },
    },
    employeeNotice: {
      loading: "Loading legal information…",
      platformPrivacyPrefix: "More information in the",
      platformPrivacyLink: "platform privacy policy",
      checkboxLabel:
        "I have read the information about the processing of my personal data (electronic acknowledgement of receipt, not consent for time tracking).",
      saving: "Saving…",
      continue: "Continue",
      accepted: "Information recorded successfully",
      defaultCompanyName: "Your company",
      documentVersion: "Document version: {{version}}",
      employeeLabel: "Employee: {{name}}",
    },
    reacceptance: {
      title: "Legal documents updated",
      description:
        "We have updated the platform texts. You must review and accept them to continue using the admin panel.",
      acknowledgeLabel:
        "I have read the documents above on behalf of my company and accept the current version. I understand they should be reviewed with an advisor before large-scale official use.",
      accept: "Accept and continue",
      saving: "Saving…",
      success: "Legal documents accepted",
      failed: "Could not record acceptance",
    },
  },
  notFound: {
    title: "Page not found",
    description:
      "Sorry, the page you are looking for doesn't exist. It may have been moved or deleted.",
    goHome: "Go home",
  },
  notifications: {
    ariaLabel: "Notifications",
    ariaLabelPending: "Notifications, {{count}} pending",
    title: "Notifications",
    subtitle: "Pending vacation, incidents, and GDPR requests",
    loading: "Loading…",
    empty: "Nothing pending.",
    gdprPending: "{{count}} pending GDPR request(s)",
    gdprReview: "Review them in Legal / GDPR",
    timeOffSection: "Vacation / leave",
    incidentsSection: "Incidents",
    viewAll: "View all",
    approve: "Approve",
    deny: "Deny",
    reject: "Reject",
    pending: "Pending",
    timeOffApproved: "Request approved",
    timeOffDenied: "Request denied",
    timeOffUpdateFailed: "Could not update request",
    incidentApproved: "Incident approved",
    incidentRejected: "Incident rejected",
    incidentUpdateFailed: "Could not update incident",
    incidentTypes: {
      late_arrival: "Late arrival",
      early_exit: "Early departure",
      absence: "Absence",
      other: "Other incident",
    },
    timeOffKinds: {
      vacation: "Vacation",
      day_off: "Day off",
    },
  },
  whatsapp: {
    contactAria: "Contact via WhatsApp",
  },
  pwa: {
    title: "Install TimeClock",
    iosHint: "In Safari: Share → Add to Home Screen.",
    androidHint: "Add TimeClock to your phone as an app for faster clock-in.",
    install: "Install app",
  },
} as const;
