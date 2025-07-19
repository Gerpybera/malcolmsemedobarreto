document.addEventListener("DOMContentLoaded", function () {
  // Get all section elements
  const aboutSection = document.getElementById("about-section");
  const schoolSection = document.getElementById("school-section");
  const skillsSection = document.getElementById("skills-section");

  // Set initial state - only show about section
  aboutSection.style.display = "block";
  schoolSection.style.display = "none";
  skillsSection.style.display = "none";

  // Get all navigation buttons
  const aboutRightArrow = aboutSection.querySelector(
    '.about-buttons img[alt="arrow-right"]'
  );
  const schoolLeftArrow = schoolSection.querySelector(
    '.about-buttons img[alt="arrow-left"]'
  );
  const schoolRightArrow = schoolSection.querySelector(
    '.about-buttons img[alt="arrow-right"]'
  );
  const skillsLeftArrow = skillsSection.querySelector(
    '.about-buttons img[alt="arrow-left"]'
  );

  // Add event listeners to buttons
  aboutRightArrow.addEventListener("click", function () {
    switchSection(aboutSection, schoolSection);
  });

  schoolLeftArrow.addEventListener("click", function () {
    switchSection(schoolSection, aboutSection);
  });

  schoolRightArrow.addEventListener("click", function () {
    switchSection(schoolSection, skillsSection);
  });

  skillsLeftArrow.addEventListener("click", function () {
    switchSection(skillsSection, schoolSection);
  });

  // Function to switch between sections
  function switchSection(currentSection, targetSection) {
    // Hide current section
    currentSection.style.display = "none";

    // Show target section
    targetSection.style.display = "block";

    // Add smooth transition effect
    targetSection.style.opacity = 0;
    setTimeout(function () {
      targetSection.style.opacity = 1;
    }, 10);
  }
});
