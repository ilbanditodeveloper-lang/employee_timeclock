/** Employee UI extensions — merged into en catalog */
export const employeeExt = {
  employee: {
    clock: {
      geolocation: {
        permissionDenied:
          "Allow location access in your browser to clock in (Settings → Permissions).",
        unavailable: "Could not get your location. Check that GPS is enabled.",
        timeout: "Location took too long. Try again outdoors or near a window.",
        fallback: "Could not get your location",
        confirmContinue:
          "Your company requires location only when clocking in. Continue?",
      },
      toasts: {
        notificationsNotConfigured:
          "Notifications are not configured. Contact your administrator.",
        invalidSession: "Invalid session",
        locationRequired:
          "Your company requires location to clock in. Allow GPS in your browser and tap Clock in again.",
        clockInSuccess: "Clock-in recorded!",
        clockInSuccessUnstable: "Clock-in recorded! (connection was unstable)",
        clockInFailed: "Could not record clock-in",
        clockInConnectionError:
          "Connection error. Wait a few seconds and tap Clock in again.",
        clockOutSuccess: "Clock-out recorded!",
        clockOutSuccessUnstable: "Clock-out recorded! (connection was unstable)",
        clockOutFailed: "Could not record clock-out",
        clockOutConnectionError:
          "Connection error. Wait a few seconds and tap Clock out again.",
        resumeSuccess: "Shift resumed",
        pauseSuccess: "Break started",
        pauseFailed: "Could not update break status",
      },
    },
  },
  common: {
    map: {
      searchAddress: "Search address",
      addressPlaceholder: "Type an address or select on the map",
      locationLabel: "Location:",
      useMyLocation: "Use my location",
      detecting: "Detecting location…",
      instructionsTitle: "Instructions:",
      instructions:
        'Click on the map to select the workplace location, or use "Use my location" to detect your current position.',
      geoUnavailable: "Geolocation is not available in your browser",
      loadError:
        "Could not load Google Maps. Check the API key and domain restrictions.",
      notFound: "Could not find the location",
      markerTitle: "Business location",
      obtainedSuccess: "Location obtained successfully",
      obtainFailed: "Could not get your location",
    },
  },
  landing: {
    mockup: {
      brandTagline: "Employee time tracking",
      liveSubtitle: "Live tracking · Sol Café · 07/01/2026",
      vacation: "Vacation",
    },
  },
} as const;
