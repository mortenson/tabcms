# tabcms - A CMS that runs completely in your browser.

This was a fun project I worked on for about a week. I thought that, given how
far web browsers have gotten, it should be possible to have a CMS completely in
your browser. So, this project is an example of how that's possible.

The code isn't the best, but it doesn't need to be. It should be a fun read for
anyone interested in IndexedDB and static site compilation in-browser.

# Install

Assets are committed to the repository, so after git cloning you should be able
to open index.html right in your browser. This is how I test locally!

# Updating assets

If you update dependencies, run `npm run build-assets`. This just copies stuff
out of `dist` in `node_modules/*`, there are no compilation steps for this
project.

CKEditor is another beast. To update that, visit their website and use the
interactive custom build generator. Select the following plugins:

- Autoformat
- Block quote
- Bold
- Heading
- Image
- Image caption
- Image style
- Image toolbar
- Image upload
- Indent
- Italic
- Link
- List
- Media embed
- Paste from Office
- Table
- Table toolbar
- Text transformation
- Alignment
- Code
- Code block
- Horizontal line
- Image resize
- Image insert
- Indent block
- List style
- Media embed toolbar
- Remove format
- Strikethrough
- Subscript
- Superscript
- Underline

Phew!
