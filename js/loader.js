// Loader functionality
document.addEventListener("DOMContentLoaded", function () {
  // Check for fake loader (only exists on index page)
  const fakeLoader = document.getElementById("fake-loader");
  if (fakeLoader) {
    const urlParams = new URLSearchParams(window.location.search);
    const forceLoader = urlParams.get("showLoader");

    // For development: Get the current domain/host
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // Check if the loader has been shown before (but force on localhost for development)
    const loaderShown = localStorage.getItem("loaderShown");

    // Check if the user is coming from within the site
    const referer = document.referrer;
    const isInternalNavigation =
      referer &&
      (referer.includes(window.location.hostname) ||
        (isLocalhost && referer.includes("localhost")));

    // Create a session variable to track if we've shown the loader in this session
    const sessionLoaderShown = sessionStorage.getItem("loaderShown");

    // Show loader if:
    // 1. It hasn't been shown before in localStorage AND
    // 2. It's not an internal navigation from within the site AND
    // 3. It hasn't been shown in this session
    // 4. OR URL has showLoader parameter set to true
    if (
      (!loaderShown && !isInternalNavigation && !sessionLoaderShown) ||
      (isLocalhost && !isInternalNavigation && !sessionLoaderShown) ||
      forceLoader === "true"
    ) {
      // Make sure the loader is visible
      fakeLoader.style.display = "flex";

      // Mark as shown in this session
      sessionStorage.setItem("loaderShown", "true");

      // Add event listener to the button
      const loaderButton = document.getElementById("loader-button");
      if (loaderButton) {
        loaderButton.addEventListener("click", function () {
          // Add the hide class to trigger the transition
          fakeLoader.classList.add("hide");

          // Set the localStorage item to remember the loader has been shown
          // Only set in production environments, not localhost
          if (!isLocalhost) {
            localStorage.setItem("loaderShown", "true");
          }

          // Remove the loader from the DOM after the transition completes
          setTimeout(function () {
            fakeLoader.style.display = "none";
          }, 1000); // Match this with the transition duration in CSS
        });
      }
    } else {
      // If loader has been shown before, hide it immediately
      fakeLoader.style.display = "none";
    }
  }

  // Mobile Navigation Menu - works on all pages
  setupMobileNavigation();
});

// Function to handle mobile navigation
function setupMobileNavigation() {
  // Check if we're on mobile or desktop view
  function isMobileView() {
    return window.innerWidth <= 768; // Match your CSS media query
  }

  console.log("Setting up mobile navigation");

  const mobileMenuButton = document.querySelector(".mobile-menu-button");
  const mobileNavOverlay = document.querySelector(".mobile-nav-overlay");
  const closeButton = document.querySelector(".close-button");

  // Console logging for debugging
  console.log("Mobile menu button found:", !!mobileMenuButton);
  console.log("Mobile nav overlay found:", !!mobileNavOverlay);
  console.log("Close button found:", !!closeButton);

  // Initially hide mobile overlay on desktop
  if (!isMobileView() && mobileNavOverlay) {
    mobileNavOverlay.style.display = "none";
    mobileNavOverlay.classList.remove("active");
  }

  if (mobileMenuButton && mobileNavOverlay && closeButton) {
    // Open mobile menu - use event delegation for better performance
    mobileMenuButton.addEventListener("click", function (event) {
      console.log("Mobile menu button clicked");
      if (isMobileView()) {
        mobileNavOverlay.classList.add("active");
        mobileNavOverlay.style.display = "block";
        document.body.style.overflow = "hidden"; // Prevent scrolling when menu is open
      }
    });

    // Close mobile menu
    closeButton.addEventListener("click", function () {
      console.log("Close button clicked");
      mobileNavOverlay.classList.remove("active");
      document.body.style.overflow = ""; // Re-enable scrolling
    });

    // Close menu when clicking a link
    const mobileNavLinks = document.querySelectorAll(".mobile-nav a");
    mobileNavLinks.forEach((link) => {
      link.addEventListener("click", function () {
        mobileNavOverlay.classList.remove("active");
        document.body.style.overflow = ""; // Re-enable scrolling
      });
    });

    // Handle resize events to hide mobile menu when switching to desktop
    window.addEventListener("resize", function () {
      if (!isMobileView() && mobileNavOverlay.classList.contains("active")) {
        mobileNavOverlay.classList.remove("active");
        document.body.style.overflow = ""; // Re-enable scrolling
      }
    });
  }
}
