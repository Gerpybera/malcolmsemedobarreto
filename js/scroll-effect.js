document.addEventListener("DOMContentLoaded", function () {
  // Select all elements with the animation class
  const animatedElements = document.querySelectorAll(".animate-fade-up");

  // Create an observer
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Add animation class when element is visible
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = "running";
          // Once it's animated, no need to observe anymore
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1, // Trigger when at least 10% of the element is visible
    }
  );

  // Apply to all elements
  animatedElements.forEach((element) => {
    element.style.animationPlayState = "paused";
    observer.observe(element);
  });
});
