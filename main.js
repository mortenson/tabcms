/*
 * Code originally created by Samuel Mortenson (mortenson.coffee).
 * This was written in ~20 hours, so please don't judge too hard!
 */
(function () {
  var PLAINTEXT_REGEXP = /(css|js|CNAME|txt|html)$/i;
  var globalState = {};
  var objectURLs = {
    form: [],
    preview: [],
  };
  var globalEditor;

  // Wraps object URL methods for memory management reasons.
  function createObjectURL(file, context) {
    var url = window.URL.createObjectURL(file);
    objectURLs[context].push(url);
    return url;
  }

  function revokeObjectURLs(context) {
    for (var i in objectURLs) {
      window.URL.revokeObjectURL(objectURLs[context][i]);
    }
    objectURLs[context] = [];
  }

  // A custom CKEditor plugin that stores uploaded files in global state.
  class MyUploadAdapter {
    constructor(loader) {
      this.loader = loader;
    }
    upload() {
      return this.loader.file.then(
        (file) =>
          new Promise((resolve, reject) => {
            globalState.files.push(file);
            resolve({
              default: createObjectURL(file, "form") + `#filename=${file.name}`,
            });
          })
      );
    }
    abort() {
      alert("Image failed to upload");
    }
  }

  function MyCustomUploadAdapterPlugin(editor) {
    editor.plugins.get("FileRepository").createUploadAdapter = (loader) => {
      return new MyUploadAdapter(loader);
    };
  }

  // Cute utility functions to mimic jQuery's $.show/hide.
  function show(element) {
    element.classList.remove("hidden");
  }

  function hide(element) {
    element.classList.add("hidden");
  }

  // Template rendering callback for EJS. Uses the user-configured templates as
  // if they were files.
  function ejsCallback(path, data) {
    var templates = getTemplates();
    for (var i in templates) {
      if (templates[i].name === path) {
        var compile = ejs.compile(templates[i].content, { client: true });
        return compile(data, null, ejsCallback);
      }
    }
    return `Template ${path} not found.`;
  }

  // Replaces asset URLs in CKEditor generated content with the file path.
  function replaceAssetUrls(html) {
    for (var match of html.matchAll(/"(blob[^"]+#filename=([^"]+))"/g)) {
      var oldUrl = match[1];
      var filename = match[2];
      html = html.replace(oldUrl, "/assets/" + filename);
    }
    return html;
  }

  // Renders a page for use in the preview or in the final static output.
  function renderPage(id) {
    var data = {
      page: getPage(id),
    };
    var compile = ejs.compile(getTemplate(0).content, { client: true });
    return compile(data, null, ejsCallback);
  }

  // Renders a page and places it in the preview iframe.
  function renderPreview(id) {
    revokeObjectURLs("preview");
    var result = renderPage(id);
    document.getElementById("preview").contentWindow.document.open();
    // Ensure relative asset paths are replaced with object URLs.
    for (var match of result.matchAll(/(?<=["'])\/?assets\/([^'"]+)/g)) {
      var oldUrl = match[0];
      var filename = match[1];
      var file;
      for (var i in globalState.files) {
        if (globalState.files[i].name === filename) {
          file = globalState.files[i];
          break;
        }
      }
      if (!file) {
        continue;
      }
      result = result.replace(oldUrl, createObjectURL(file, "preview"));
    }
    result = refreshBlobURLs(result);
    document.getElementById("preview").contentWindow.document.write(result);
    document.getElementById("preview").contentWindow.document.close();
    document.getElementById(
      "preview"
    ).contentWindow.document.body.onclick = function (e) {
      var target = e.target;
      if (typeof target.href !== "string") {
        return;
      }
      e.preventDefault();
      // We could enable local navigation by trapping clicks, but without a URL
      // bar or forward/back functionality it feels really bad.
      alert("Navigation is disabled in the preview.");
    };
  }

  // Helper function to generate safe clickable links.
  function getSidebarItem(index, text) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "#main";
    a.setAttribute("data-index", index);
    a.innerText = text;
    li.appendChild(a);
    return li;
  }

  // Renders the sidebar.
  function renderSidebar() {
    pageList = document.getElementById("page-list");
    pageList.innerHTML = "";
    getPages().forEach(function (page, index) {
      pageList.appendChild(getSidebarItem(index, page.title));
    });
    templateList = document.getElementById("template-list");
    templateList.innerHTML = "";
    getTemplates().forEach(function (template, index) {
      templateList.appendChild(getSidebarItem(index, template.name));
    });
    fileList = document.getElementById("file-list");
    fileList.innerHTML = "";
    var files = getFiles();
    files.forEach(function (file, index) {
      fileList.appendChild(getSidebarItem(index, file.name));
    });
    if (!files.length) {
      fileList.innerHTML = "No files uploaded.";
    }
  }

  // Refreshes blob URLs that may have been revoked.
  function refreshBlobURLs(html) {
    for (var match of html.matchAll(/"(blob[^"]+#filename=([^"]+))"/g)) {
      var oldUrl = match[1];
      var filename = match[2];
      var file;
      var files = getFiles();
      for (var j in files) {
        if (files[j].name === filename) {
          file = files[j];
          break;
        }
      }
      if (!file) {
        continue;
      }
      html = html.replace(
        oldUrl,
        createObjectURL(file, "form") + `#filename=${file.name}`
      );
    }
    return html;
  }

  // Long helper function to show and initialize a form based on the currently
  // selected thing.
  function openForm(type, id) {
    revokeObjectURLs("form");
    globalState.currentForm = type;
    switch (type) {
      case "page":
        globalState.currentPage = id;
        show(document.getElementById("page-form"));
        hide(document.getElementById("file-form"));
        hide(document.getElementById("template-form"));
        var currentPage = getPage(globalState.currentPage);
        currentPage.body = refreshBlobURLs(currentPage.body);
        globalEditor.setData(currentPage.body);
        var title = document.getElementById("title");
        title.value = currentPage.title;
        document.getElementById("path").value = currentPage.path;
        title.focus();
        break;
      case "template":
        globalState.currentTemplate = id;
        hide(document.getElementById("page-form"));
        hide(document.getElementById("file-form"));
        show(document.getElementById("template-form"));
        var currentTemplate = getTemplate(globalState.currentTemplate);
        var template = document.getElementById("template");
        var name = document.getElementById("name");
        template.value = currentTemplate.content;
        name.value = currentTemplate.name;
        name.disabled = currentTemplate.name === "html";
        template.focus();
        break;
      case "file":
        globalState.currentFile = id;
        hide(document.getElementById("page-form"));
        show(document.getElementById("file-form"));
        hide(document.getElementById("template-form"));
        var currentFile = getFile(globalState.currentFile);
        var preview = document.getElementById("file-preview");
        var contents = document.getElementById("file-contents");
        if (currentFile.name.match(/(png|jpg|jpeg|gif|svg|webp)$/i)) {
          preview.innerHTML = `<img src="${createObjectURL(
            currentFile,
            "form"
          )}"></img>`;
        } else {
          preview.innerHTML = "";
        }
        if (currentFile.name.match(PLAINTEXT_REGEXP)) {
          currentFile.text().then(function (text) {
            contents.value = text;
            show(document.getElementById("file-contents-wrapper"));
          });
        } else {
          contents.value = "";
          hide(document.getElementById("file-contents-wrapper"));
        }
        document.getElementById("file-name").value = currentFile.name;
        var usage = document.getElementById("file-usage");
        usage.innerHTML = "";
        var usageList = document.createElement("ul");
        var pages = getPages();
        for (var i in pages) {
          if (pages[i].body.match(currentFile.name)) {
            var li = document.createElement("li");
            li.innerText = pages[i].title;
            usageList.append(li);
          }
        }
        if (usageList.children.length) {
          usage.innerHTML =
            "<div>This file is used by the following pages:</div>";
          usage.append(usageList);
        }
        break;
      default:
        break;
    }
    renderSidebar();
  }

  // Getter/setter functions with the hope of abstracting globalState from
  // most of the app. This was nice when I thought I was going to use IndexedDB
  // in a structured way instead of slamming all of the state in at once.
  function getPage(id) {
    return globalState.pages[id];
  }

  function getPages() {
    return globalState.pages;
  }

  function addPage(title, body, path) {
    globalState.pages.push({
      title: title,
      body: body,
      path: path,
    });
  }

  function removePage(id) {
    globalState.pages.splice(id, 1);
  }

  function updatePage(id, title, body, path) {
    globalState.pages[id] = {
      title: title,
      body: body,
      path: path,
    };
  }

  function getTemplate(id) {
    return globalState.templates[id];
  }

  function getTemplates() {
    return globalState.templates;
  }

  function addTemplate(name, content) {
    globalState.templates.push({
      name: name,
      content: content,
    });
  }

  function removeTemplate(id) {
    globalState.templates.splice(id, 1);
  }

  function updateTemplate(id, name, content) {
    globalState.templates[id] = {
      name: name,
      content: content,
    };
  }

  function getFile(id) {
    return globalState.files[id];
  }

  function getFiles() {
    return globalState.files;
  }

  function addFile(file) {
    globalState.files.push(file);
  }

  function removeFile(id) {
    globalState.files.splice(id, 1);
  }

  // Initializes the app - called at the start of page load.
  function initApp() {
    globalState = {
      currentPage: null,
      currentTemplate: null,
      currentFile: null,
      currentForm: null,
      pages: [],
      files: [],
      templates: [],
    };
    return ClassicEditor.create(document.querySelector("#editor"), {
      extraPlugins: [MyCustomUploadAdapterPlugin],
      mediaEmbed: {
        previewsInData: true,
      },
      image: {
        resizeOptions: [
          {
            name: "imageResize:original",
            label: "Original",
            value: null,
          },
          {
            name: "imageResize:50",
            label: "50%",
            value: "50",
          },
          {
            name: "imageResize:75",
            label: "75%",
            value: "75",
          },
        ],
        toolbar: ["imageResize", "|", "imageTextAlternative", "|", "linkImage"],
      },
      toolbar: {
        items: [
          "heading",
          "|",
          "bold",
          "italic",
          "underline",
          "link",
          "bulletedList",
          "numberedList",
          "alignment",
          "|",
          "imageInsert",
          "mediaEmbed",
          "|",
          "indent",
          "outdent",
          "blockQuote",
          "insertTable",
          "|",
          "strikethrough",
          "subscript",
          "superscript",
          "|",
          "code",
          "codeBlock",
          "|",
          "removeFormat",
        ],
      },
      language: "en",
      table: {
        contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
      },
    })
      .then((editor) => {
        globalEditor = editor;
      })
      .catch((error) => {
        alert("Error initializing CKEditor.");
        console.error(error);
      });
  }

  // Credit https://gist.github.com/peduarte/7ee475dd0fae1940f857582ecbb9dc5f
  function debounce(func) {
    var wait =
      arguments.length <= 1 || arguments[1] === undefined ? 100 : arguments[1];

    var timeout = void 0;
    return function () {
      var _this = this;

      for (
        var _len = arguments.length, args = Array(_len), _key = 0;
        _key < _len;
        _key++
      ) {
        args[_key] = arguments[_key];
      }

      clearTimeout(timeout);
      timeout = setTimeout(function () {
        func.apply(_this, args);
      }, wait);
    };
  }

  // Stores the state using localforage. For most browsers, this should go in
  // IndexedDB, which also has support for blobs, which takes care of files.
  function storeState() {
    localforage.setItem("globalState", globalState);
  }

  // Saves whatever is in the current form. Called often.
  function autoSave() {
    switch (globalState.currentForm) {
      case "page":
        var title = document.getElementById("title");
        var path = document.getElementById("path");
        updatePage(
          globalState.currentPage,
          title.value,
          globalEditor.getData(),
          path.value
        );
        break;
      case "template":
        var name = document.getElementById("name");
        var content = document.getElementById("template");
        updateTemplate(globalState.currentTemplate, name.value, content.value);
        break;
      case "file":
        var name = document.getElementById("file-name").value;
        var currentFile = globalState.files[globalState.currentFile];
        var contents = document.getElementById("file-contents");
        if (currentFile.name.match(PLAINTEXT_REGEXP)) {
          var blob = new Blob([contents.value]);
          globalState.files[globalState.currentFile] = new File(
            [blob],
            currentFile.name
          );
        }
        if (name !== currentFile.name) {
          var blob = currentFile.slice(0, currentFile.size, currentFile.type);
          globalState.files[globalState.currentFile] = new File([blob], name);
        }
        if (
          globalState.files[globalState.currentFile].name.match(
            PLAINTEXT_REGEXP
          )
        ) {
          show(document.getElementById("file-contents-wrapper"));
        } else {
          hide(document.getElementById("file-contents-wrapper"));
        }
        break;
      default:
        break;
    }
    renderSidebar();
    renderPreview(globalState.currentPage);
    storeState();
  }

  // Sanitizes a path by stripping forward slashes and periods.
  function sanitizePath(path) {
    path = path.replace(/^[\/]+|[\/]+$/g, "");
    path = path.replace(/(\/)\/+/g, "$1");
    path = path.replace(/\./g, "");
    return path;
  }

  // Resets the site to its default state.
  function resetSite() {
    globalState = {
      currentPage: null,
      currentTemplate: null,
      currentFile: null,
      currentForm: null,
      pages: [],
      files: [],
      templates: [],
    };
    // prettier-ignore
    addTemplate(
      "html",
      `<!DOCTYPE html>
<html dir="ltr" lang="en">
    <meta charset="utf-8" />
    <head>
        <title><%= page.title %></title>
        <link rel="stylesheet" href="/assets/main.css" />
    </head>
    <body>
        <%- include("header", {page: page}); %>
        <%- include("main", {page: page}); %>
        <%- include("footer", {page: page}); %>
    </body>
</html>`
    );
    // prettier-ignore
    addTemplate(
      "header",
      `<header>
</header>`
    );
    // prettier-ignore
    addTemplate(
      "footer",
      `<footer>
</footer>`
    );
    // prettier-ignore
    addTemplate(
      "main",
      `<main>
    <h1><%= page.title %></h1>
    <div class="page-body">
      <%- page.body %>
    </div>
</main>`
    );
    // prettier-ignore
    globalState.files.push(new File([`.page-body img {
    max-width: 500px;
}
`], "main.css"));
    addPage("Home", "<p>Welcome to my <strong>home page</strong>!</p>", "/");
    openForm("page", getPages().length - 1);
  }

  // Prompts the user to upload a new file.
  function uploadFile() {
    var input = document.createElement("input");
    input.type = "file";
    input.onchange = function () {
      globalState.files.push(this.files[0]);
      storeState();
      renderSidebar();
      openForm("file", globalState.files.length - 1);
    };
    input.click();
  }

  // Accepts a site archive and sets global state and files appropriately.
  function uploadSite() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "application/zip";
    input.onchange = function () {
      var zip = new JSZip();
      zip.loadAsync(this.files[0]).then(function (zip) {
        var json = zip
          .file("site.json")
          .async("string")
          .then(function (content) {
            try {
              var processed = JSON.parse(content);
            } catch (e) {
              console.error(e);
              alert("Unable to parse site.json");
              return;
            }
            if (
              !confirm(
                "Importing this archive will erase your current site, are you sure you want to proceed?"
              )
            ) {
              return;
            }
            globalState = processed;
            globalState.files = [];
            var promises = [];
            for (var i in zip.files) {
              if (!i.match(/^www\/assets/)) {
                continue;
              }
              var file = zip.file(i);
              if (!file) {
                continue;
              }
              var promise = file.async("blob");
              promises.push(promise);
              promise.then(
                (function () {
                  var filename = i.replace(/.*\//, "");
                  return function (content) {
                    globalState.files.push(new File([content], filename));
                  };
                })()
              );
            }
            Promise.all(promises).then((values) => {
              storeState();
              renderSidebar();
              openForm("page", globalState.currentPage);
              renderPreview(globalState.currentPage);
            });
          });
        if (json === null) {
          alert("No site.json found in archive.");
          return;
        }
      });
    };
    input.click();
  }

  // Downloads the site, and its static HTML, as a ZIP.
  function downloadSite() {
    var zip = new JSZip();
    zip.file("site.json", JSON.stringify(globalState));
    var www = zip.folder("www");
    files = getFiles();
    for (var i in files) {
      www.file("assets/" + files[i].name, files[i]);
    }
    pages = getPages();
    for (i in pages) {
      var html = replaceAssetUrls(renderPage(i));
      var path = sanitizePath(pages[i].path);
      www.file(path + "/index.html", html);
    }
    zip.generateAsync({ type: "blob" }).then(function (content) {
      // Credit to https://blog.logrocket.com/programmatic-file-downloads-in-the-browser-9a5186298d5c/
      var url = window.URL.createObjectURL(content);
      var a = document.createElement("a");
      a.href = url;
      a.download = "tabcms.zip";
      var clickHandler = () => {
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          this.removeEventListener("click", clickHandler);
        }, 150);
      };
      a.addEventListener("click", clickHandler, false);
      a.click();
    });
  }

  // Initializes events used by the app.
  function initEvents() {
    document.getElementById("add-page").onclick = function () {
      addPage("Untitled", "", "untitled");
      openForm("page", getPages().length - 1);
    };
    document.getElementById("add-template").onclick = function () {
      addTemplate("newTemplate", "");
      openForm("template", getTemplates().length - 1);
    };
    document.getElementById("add-file").onclick = function () {
      addFile(new File([""], "untitled.css"));
      openForm("file", getFiles().length - 1);
    };
    document.getElementById("page-list").onclick = function (event) {
      if (event.target.dataset.index !== undefined) {
        openForm("page", event.target.dataset.index);
      }
    };
    document.getElementById("template-list").onclick = function (event) {
      if (event.target.dataset.index !== undefined) {
        openForm("template", event.target.dataset.index);
      }
    };
    document.getElementById("file-list").onclick = function (event) {
      if (event.target.dataset.index !== undefined) {
        openForm("file", event.target.dataset.index);
      }
    };
    document.getElementById("delete-page").onclick = function (e) {
      e.preventDefault();
      currentPage = getPage(globalState.currentPage);
      if (getPages().length === 1) {
        alert("You must have at least one page.");
        return;
      }
      if (confirm(`Are you sure you want to delete ${currentPage.title}?`)) {
        removePage(globalState.currentPage);
        openForm("page", 0);
        storeState();
      }
    };
    document.getElementById("delete-template").onclick = function (e) {
      e.preventDefault();
      currentTemplate = getTemplate(globalState.currentTemplate);
      if (currentTemplate.name === "html") {
        alert("You cannot delete the html template.");
        return;
      }
      if (confirm(`Are you sure you want to delete ${currentTemplate.name}?`)) {
        removeTemplate(globalState.currentTemplate);
        openForm("template", 0);
        storeState();
      }
    };
    document.getElementById("expand-preview").onclick = function () {
      var button = document.getElementById("expand-preview");
      if (button.innerText === "Expand") {
        hide(document.getElementById("sidebar"));
        hide(document.getElementById("main"));
      } else {
        show(document.getElementById("sidebar"));
        show(document.getElementById("main"));
      }
      button.innerText = button.innerText === "Expand" ? "Collapse" : "Expand";
    };
    document.getElementById("delete-file").onclick = function (e) {
      e.preventDefault();
      currentFile = getFile(globalState.currentFile);
      if (confirm(`Are you sure you want to delete ${currentFile.name}?`)) {
        removeFile(globalState.currentFile);
        openForm("page", 0);
        storeState();
      }
    };
    document.getElementById("download-site").onclick = function (e) {
      downloadSite();
    };
    document.getElementById("reset-site").onclick = function (e) {
      if (
        !confirm(
          "Are you sure you want to delete your current site and start a new one?"
        )
      ) {
        return;
      }
      resetSite();
    };
    document.getElementById("upload-site").onclick = function (e) {
      uploadSite();
    };
    document.getElementById("upload-file").onclick = function (e) {
      uploadFile();
    };
    autoSaveDebounce = debounce(autoSave, 500);
    document.getElementById("title").onchange = autoSaveDebounce;
    document.getElementById("title").onkeyup = autoSaveDebounce;
    document.getElementById("path").onchange = autoSaveDebounce;
    document.getElementById("path").onkeyup = autoSaveDebounce;
    document.getElementById("name").onkeyup = autoSaveDebounce;
    document.getElementById("template").onkeyup = autoSaveDebounce;
    document.getElementById("file-contents").onkeyup = autoSaveDebounce;
    document.getElementById("file-name").onkeyup = autoSaveDebounce;
    globalEditor.model.document.on("change:data", autoSaveDebounce);
    enableTextareaTabbing(document.getElementById("file-contents"));
    enableTextareaTabbing(document.getElementById("template"));
  }

  initApp().then(function () {
    initEvents();
    storedState = localforage
      .getItem("globalState")
      .then(function (value) {
        if (value) {
          globalState = value;
          renderSidebar();
          renderPreview(globalState.currentPage);
          openForm("page", 0);
          return;
        }
        // Otherwise set up some defaults.
        resetSite();
      })
      .catch(function (err) {
        console.error(err);
        alert(
          "Unable to read the stored state. You may want to backup/delete your IndexedDB for this site."
        );
      });
  });
})();
