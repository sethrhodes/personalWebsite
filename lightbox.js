document.addEventListener("DOMContentLoaded", () => {
  // Create lightbox elements
  const lightbox = document.createElement("div");
  lightbox.className = "lightbox-backdrop";
  const lbImg = document.createElement("img");
  
  // Close button (X)
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "&times;";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "20px";
  closeBtn.style.right = "20px";
  closeBtn.style.background = "none";
  closeBtn.style.border = "none";
  closeBtn.style.color = "white";
  closeBtn.style.fontSize = "3rem";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.zIndex = "1001";
  closeBtn.ariaLabel = "Close lightbox";

  lightbox.appendChild(lbImg);
  lightbox.appendChild(closeBtn);
  document.body.appendChild(lightbox);

  const closeLightbox = () => lightbox.classList.remove("active");
  
  // Close events
  lightbox.addEventListener("click", (e) => {
    if (e.target !== lbImg) closeLightbox();
  });
  closeBtn.addEventListener("click", closeLightbox);
  document.addEventListener("keyup", (e) => { if (e.key === "Escape") closeLightbox(); });

  // Attach click handlers to images
  const images = document.querySelectorAll(".mosaic-tile img, .mosaic-hero img, .resume-section img");
  images.forEach(img => {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => {
      lbImg.src = img.getAttribute("data-full") || img.src;
      lightbox.classList.add("active");
    });
  });
});
