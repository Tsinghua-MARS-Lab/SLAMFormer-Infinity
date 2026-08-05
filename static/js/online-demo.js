(function () {
  var sequences = [
    ["00", "ONLINE RUN"], ["01", "ONLINE RUN"], ["02", "5,067 M ROUTE"],
    ["03", "ONLINE RUN"], ["04", "394 M ROUTE"], ["05", "2,206 M ROUTE"],
    ["07", "ONLINE RUN"], ["09", "1,705 M ROUTE"], ["10", "920 M ROUTE"],
    ["11", "ONLINE RUN"], ["12", "ONLINE RUN"], ["15", "ONLINE RUN"],
    ["17", "ONLINE RUN"], ["18", "ONLINE RUN"], ["19", "ONLINE RUN"],
    ["20", "ONLINE RUN"], ["21", "ONLINE RUN"]
  ];

  function initOnlineDemoCarousel() {
    var root = document.querySelector("[data-online-demo-carousel]");
    if (!root) return;

    var track = root.querySelector("[data-online-demo-track]");
    var viewport = root.querySelector("[data-online-demo-viewport]");
    var currentLabel = root.querySelector("[data-online-demo-current]");
    var previousButton = root.querySelector("[data-online-demo-prev]");
    var nextButton = root.querySelector("[data-online-demo-next]");
    var toggleButton = root.querySelector("[data-online-demo-toggle]");
    var cards = [];
    var activeIndex = 0;
    var autoPlay = true;
    var scrollFrame = 0;

    function createCard(sequence, route) {
      var card = document.createElement("article");
      card.className = "online-demo-card";
      card.dataset.onlineDemoCard = "true";
      card.dataset.onlineDemoSrc = "./static/demo/kitti-" + sequence + ".mp4";
      card.dataset.sequence = sequence;
      card.dataset.route = route;
      card.setAttribute("aria-label", "KITTI Sequence " + sequence + " online SLAM demo");
      card.innerHTML = [
        '<div class="online-demo-card-label"><b>' + sequence + '</b><span>' + route + '</span></div>',
        '<div class="online-demo-card-video"><video muted playsinline preload="none"></video><span data-online-demo-loading>STREAM WHEN CENTERED</span></div>',
        '<div class="online-demo-card-caption"><strong>KITTI ' + sequence + '</strong><small>Online SLAM</small></div>'
      ].join("");
      track.appendChild(card);
      return card;
    }

    sequences.forEach(function (item) {
      cards.push(createCard(item[0], item[1]));
    });

    function markLoaded(card) {
      var frame = card.querySelector(".online-demo-card-video");
      frame.classList.add("is-loaded");
    }

    function unloadCard(card) {
      var video = card.querySelector("video");
      if (!video.dataset.loaded) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
      delete video.dataset.loaded;
      card.querySelector(".online-demo-card-video").classList.remove("is-loaded");
    }

    function loadCard(card, play) {
      var video = card.querySelector("video");
      video.controls = play;
      video.muted = true;

      if (!video.dataset.loaded) {
        video.src = card.dataset.onlineDemoSrc;
        video.dataset.loaded = "true";
        video.addEventListener("loadeddata", function () {
          markLoaded(card);
          if (play && card.classList.contains("is-center")) {
            video.play().catch(function () {});
          }
        }, { once: true });
        video.load();
      }

      if (play && video.readyState >= 2) {
        video.play().catch(function () {});
      } else {
        video.pause();
      }
    }

    function updateCurrent(index) {
      var card = cards[index];
      activeIndex = index;
      cards.forEach(function (item, itemIndex) {
        var active = itemIndex === index;
        item.classList.toggle("is-center", active);
        item.setAttribute("aria-current", active ? "true" : "false");
        if (active || Math.abs(itemIndex - index) <= 1) loadCard(item, active);
        else unloadCard(item);
      });
      currentLabel.textContent = "SEQUENCE " + card.dataset.sequence + " / " + card.dataset.route;
    }

    function centerCard(index, behavior) {
      var bounded = (index + cards.length) % cards.length;
      var card = cards[bounded];
      updateCurrent(bounded);
      var targetLeft = card.offsetLeft - (viewport.clientWidth - card.offsetWidth) / 2;
      var maxScroll = track.scrollWidth - track.clientWidth;
      targetLeft = Math.max(0, Math.min(targetLeft, maxScroll));
      track.scrollTo({
        behavior: behavior ? "smooth" : "auto",
        left: targetLeft
      });
    }

    function findCenteredCard() {
      var viewportCenter = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
      var closestIndex = activeIndex;
      var closestDistance = Infinity;
      cards.forEach(function (card, index) {
        var rect = card.getBoundingClientRect();
        var distance = Math.abs(rect.left + rect.width / 2 - viewportCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      if (closestIndex !== activeIndex) updateCurrent(closestIndex);
    }

    function queueCenterUpdate() {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(findCenteredCard);
    }

    function move(step) {
      centerCard(activeIndex + step, true);
    }

    previousButton.addEventListener("click", function () { move(-1); });
    nextButton.addEventListener("click", function () { move(1); });
    toggleButton.addEventListener("click", function () {
      autoPlay = !autoPlay;
      toggleButton.textContent = autoPlay ? "Pause auto advance" : "Resume auto advance";
      toggleButton.setAttribute("aria-pressed", String(autoPlay));
      if (autoPlay) {
        loadCard(cards[activeIndex], true);
      }
    });

    track.addEventListener("scroll", queueCenterUpdate, { passive: true });
    cards.forEach(function (card, index) {
      card.addEventListener("click", function (event) {
        if (event.target.closest("video") && index === activeIndex) return;
        centerCard(index, true);
      });
    });

    window.setInterval(function () {
      if (autoPlay && document.visibilityState === "visible") move(1);
    }, 20000);

    centerCard(0, false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOnlineDemoCarousel);
  } else {
    initOnlineDemoCarousel();
  }
}());
