(function () {
  var tour = new Shepherd.Tour({
    defaultStepOptions: {
      classes: "shadow-md bg-purple-dark",
      scrollTo: true,
    },
  });

  tour.addStep({
    text: "Welcome to tabcms, a CMS that runs completely in your browser!",
    buttons: [
      {
        text: "Next",
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    text:
      "This is the page list. Pages are the content that powers your site, and allow you to edit content and upload images inline.",
    attachTo: {
      element: "#page-list",
      on: "right",
    },
    buttons: [
      {
        text: "Next",
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    text:
      'This is the template list. Templates contain the HTML that wraps your content, and are written using <a href="https://ejs.co/" target="_blank">EJS</a>.',
    attachTo: {
      element: "#template-list",
      on: "right",
    },
    buttons: [
      {
        text: "Next",
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    text:
      "This is the file list. Files can be anything from uploaded images to CSS and JS files. CSS and JS files can be edited right in the CMS!",
    attachTo: {
      element: "#file-list",
      on: "right",
    },
    buttons: [
      {
        text: "Next",
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    text:
      "Most of the buttons are self-explanatory, but this one downloads your site content and generates a static site you can upload right to a web server.",
    attachTo: {
      element: "#download-site",
      on: "right",
    },
    buttons: [
      {
        text: "Next",
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    text:
      "Once downloaded, the archive of your site can be uploaded at any time to get back into editing.",
    attachTo: {
      element: "#upload-site",
      on: "right",
    },
    buttons: [
      {
        text: "Next",
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    text:
      "That's about it - I made this in a week so enjoy it as a fun experiment on what's possible in your browser. Thanks!",
    buttons: [
      {
        text: "Finish",
        action: tour.next,
      },
    ],
  });

  if (!localStorage.tourDone) {
    localStorage.tourDone = true;
    tour.start();
  }
})();
