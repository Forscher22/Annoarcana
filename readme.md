# eleventy-webcomic

> This is a quick overview of things if you kind of know what you're doing. More extensive instructions are coming!!

This is a template of a template of a template. Eleventy-webcomic is a template, built off of the Rashon's [eleventy-rarebit](), which itself is built to replicate the functionality found in [geno7's](https://geno7.neocities.org/) [Rarebit](https://rarebit.neocities.org/) webcomic template.

## Features

- **Mostly Static**: Built from [Liquid](https://www.11ty.dev/docs/languages/liquid/) templates, pages core functions no longer require JavaScript. ([Why does this matter?](https://adamsilver.io/blog/javascript-isnt-always-available-and-its-not-the-users-fault/)). There are some "additional" features (comments, navigating with keyboard arrow keys, archive drop down selection) which require javascript, but the core reading experience functions just fine!

- **Drag and Drop**: No more fiddling with JavaScript to add updates; comic pages can be added with [Markdown](https://www.11ty.dev/docs/languages/markdown/) through custom [front matter](https://www.11ty.dev/docs/data-frontmatter/).

- **Beginner Friendly**: eleventy-rarebit-template maintains the same philosophy as Rarebit to be as beginner friendly as possible. Files are commented extensively with constant references to the Eleventy Docs and other relevant documentation. In addition, I'm working on a setup tutorial [over here](https://webcomics.fyi/templates/my-template.html).

- **RSS Feed**: An RSS feed of your comic is automatically generated after some very slight setup. I've added this because people still frequently use them (especially for webcomics), and some webrings require you to have one in order to be listed with them.

- **more “neutral” default styling** (mostly done for my site, but why not 🤷‍♀️)

- **revamp of the archive.** It is explicitly divided by chapters, and only shows one image per chapter (and using 11ty img to output it at a smaller size). Additionally, there's a dropdown selection to go to a page for chapter

- **added explicit date setting in the post**, in case folks copy a file to make a new page, using the github repo as a pseudo-CMS.

- **ability to add comments**, leveraging google forms (big shout to the jekyll guy). We've even got emojis! 💅

- **added back arrowkey navigation**, because folks seem really set on it

## Deployment

### Netlify
1. Make sure you have a Github account setup first.

2. Click this button: [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/katedee/eleventy-webcomic)


### Neocities

1. [Create a new GitHub repository from this template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template#creating-a-repository-from-a-template)
2. From your [account settings](https://neocities.org/settings) in Neocities, generate an API key for your site by clicking **Manage Site Settings (of target site) > API > Generate API Key**
3. [Add the API key as an action secret to your repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template#creating-a-repository-from-a-template) with the name `NEOCITIES_API_TOKEN`
4. Download [GitHub Desktop](https://desktop.github.com/) and [clone the repository to your computer](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop#cloning-a-repository)
5. Open the cloned repository in a [terminal window](https://www.11ty.dev/docs/terminal-window/) and, [assuming Node.JS is installed](https://nodejs.org/), type `npm install`
6. In the same terminal, start a local webserver by entering `npm start`

You now have a hot-reloading preview of your website! Go ahead and start tailoring the template for your comic. When you're ready to publish, just [commit](https://docs.github.com/en/desktop/making-changes-in-a-branch/committing-and-reviewing-changes-to-your-project-in-github-desktop) and [push]() your changes in GitHub Desktop; your site should update on Neocities shortly afterwards!

## Usage & Eleventy
> **If you're new to Eleventy, make sure you go over its [Getting Started](https://www.11ty.dev/docs/getting-started/) guide.**

Comic pages can be stored in any subfolder within your Eleventy project's [input directory](https://www.11ty.dev/docs/config/#input-directory). You can specify their custom data - whether that be titles, images, or thumbnails -  through [template and directory data files](https://www.11ty.dev/docs/data-template-dir/) or [front matter data](https://www.11ty.dev/docs/data-frontmatter/).

```json
// Directory Data
{
  "tags": ["comic"],
  "thumb": "/img/thumbs/default.png",
  "layout": "layouts/strip.liquid"
}
```

```yaml
---
# Front Matter Data
title: The First Page Title
images: ['/img/comics/pg1.jpg']
alt: Here's some alt text!
thumb: '/img/thumbs/pg1.png'
tags:
  - chapter1
---
```

[Layouts](https://www.11ty.dev/docs/layouts/) can then be applied to define how the page and its data are rendered. 

```liquid
<!-- `strip.liquid` (Snippet) -->
<div class="comic">
  <h1>{{ title }}</h1>
  {% render 'comic.liquid', collection: collections.comic, page: page, images: images, alt: alt %}
</div>
```

Still curious? [Start exploring the template](https://github.com/covalria-sow/eleventy-rarebit-template/blob/master/index.liquid) or [see it working for yourself](https://eleventy-rarebit.neocities.org/)!


### Pages between page numbers

Page numbers are whole numbers (comments and author notes are tied to them). For pages that sit between two numbered pages, like an interlude, name the file so it sorts in the right spot (e.g. `30a.md`, `30b.md` come after `30.md` and before `31.md`) and give it a reserved `pageNumber` of 1000 or more in its front matter. The Studio skips these numbers when suggesting the next page number.
