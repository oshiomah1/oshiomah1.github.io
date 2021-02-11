---
layout: post
title:  "Week 4 Walkthrough- Manual Binning"
date:   2021-02-12
excerpt: "ggKbase binning!"
project: "ESPM_112L"
tag:
- test
comments: true
---


``
<h1>Hello and welcome to week 4 of ESPM 112L-</h1>

<h1>Metagenomic Data Analysis Lab!</h1>

* TOC
{:toc}


This week's lab is one of the most fun of the semester- you all are going to get to do some manual binning with our lab's tool, ggKbase!

ggKbase is a spectacular way to visualize the ways we separate out genomes from metagenomes, and unlike automatic binning software, you can see and control the whole process!

Similar platforms like Anvi'o (https://merenlab.org/software/anvio/) are available for manual binning, although slightly different from what you'll be using today.

# What is binning?

Remember, we start with a whole community of microorganisms, so we have DNA from multiple origin genomes.

The assembler, as you'll recall from last week, does a pretty good job of piecing these things together, but we're still left with fragments of these original genomes.

Binning is the process of choosing which of these fragments likely originated from the same genome, and stitching them together into genome bins (sometimes called MAGs, or Metagenome-Assembled Genomes, in the literature).

Each group will be binning their own sample this week, and this document will show you how.

---

# ggKbase

ggKbase is our lab's platform for metagenomic data analysis. Head on over to https://class.ggkbase.berkeley.edu; we're going to make each of you an account.

When you get to the homepage, go to the top right and click "Create an account". (Ctrl+F if you can't find it.) Here's what you should see:

<img src="https://github.com/jwestrob/jwestrob.github.io/blob/master/assets/img/ggkbase_create_account.png" width=250>

When you do this, don't sign up with a real username- I have to give you each access to your bins manually, so I need your real names. If you do happen to use a different name or a username when signing up, let me know on slack so I can find you and give you access.

In the meantime, let's go over binning principles.

## Navigating ggKbase

I'm going to start with an example project and show you how to bin it; we'll have a demo also during class from Jill, who's the absolute expert on manual binning with ggKbase- pay close attention to how she does it!

Let's start by going to the Projects page, which you can access with the button on the top left (ctrl+F "projects" if you can't find it) - you probably won't see anything until I give you access to your team's sample. Here's what I see (I have access to all the projects as the class instructor):

<img src="https://github.com/jwestrob/jwestrob.github.io/blob/master/assets/img/Horse_Projects.png" width=250>

Let's select our example project - this sample isn't assigned to any team, so don't get confused and try to find it! None of you will have access to this one.

# Binning

Once you click on the name of the sample, you'll see this page:

<img src="https://github.com/jwestrob/jwestrob.github.io/blob/master/assets/img/HF3_S142_UNKpage.png" width=250>

Click "Bin organism" to get started.

<img src="https://github.com/jwestrob/jwestrob.github.io/blob/master/assets/img/ggkbase_all_features.png" width=250>

Binning involves using all of this information to separate out genomes; here's what all of these features mean.

## Feature types

There are three features to select from when binning: Taxonomy, GC content, and coverage.

There are three more boxes on the right-hand side, too:

- Ribosomal proteins (you want one copy of as many as you can get; duplicates are bad but not the end of the world)
- Bacterial single-copy genes (SCGs)- as the name implies, you also want one copy of as many as you can get.
- Archaeal SCGs - You won't find many of these in your samples, but if you were looking for Archaea, you'd treat them the same as bacterial SCGs.

If you get an ideal bin, the taxonomy wheel should show a consistent color and you should have one copy of (most of) the ribosomal proteins and bacterial SCGs.

### Taxonomy

The Taxonomy wheel in this case displays the "consensus taxonomy" of a contig. It looks like this:

<img src="https://github.com/jwestrob/jwestrob.github.io/blob/master/assets/img/taxonomywheel.png" width=250>

From the innermost ring, each ring represents, in order, Domain, Phylum, Class, Order, Family, Genus and Species. Each group is color-coded for easy navigation- as you get more used to it, you'll start finding this scheme very convenient to visualize who's living in your sample.

Essentially, we search every protein sequence against a huge database, and label each protein with the taxonomic ID of the best hit in the database. So if we searched, say, a DNA Polymerase subunit against our database and it came back with its best hit as an _E. coli_, that protein would be labeled

```
Bacteria -> Proteobacteria -> Gammaproteobacteria -> Enterobacterales -> Enterobacteraceae -> Escherichia -> Escherichia coli
```

When we say a 'contig' (here we use the term interchangeably with 'scaffold') has a certain taxonomy, that means more than 50% of the proteins on that contig share taxonomy at that level. For example, if the rest of the contigs on our imaginary example contigs only had hits from other `Enterobacterales` but not from `Enterobacteraceae` or lower divisions, the contig would show up as `Enterobacterales`.

You can use this wheel to select contigs that share taxonomic affiliation. Try clicking around to see what's going on; remember there's a grey 'reset' button that will remove your selection and take you back.

### GC Content

GC Content is one of the best ways to separate genomes from a sample. Here's what it should look like before you do anything:

<img src="https://github.com/jwestrob/jwestrob.github.io/blob/master/assets/img/gc_content.png" width=250>

Now, when you make a selection in other feature types (like coverage or taxonomy) you'll see the distribution change here; in this example I've selected all the contigs with a coverage value between 60 and 80.

<img src="https://github.com/jwestrob/jwestrob.github.io/blob/master/assets/img/gc_content_spike.png" width=250>

Notice how the GC content now has a spike at around 47 and another at ~55? See also how the taxonomy wheel has changed; how it's mostly beige (the phylum Bacteroidetes) with a little bit of green (Firmicutes).

Let's try selecting that second GC content spike and see what happens:

<img src="https://github.com/jwestrob/jwestrob.github.io/blob/master/assets/img/firmicutes_gc.png" width=250>

Would you look at that! See how there's one copy of all those ribosomal proteins and single-copy genes? That's an indicator of a pretty good genome. This is a pretty good summary of what you need to do

### Coverage

Coverage, remember, is how many reads align to each position (on average) across a contig/scaffold. For organisms that were more abundant in the original community, we generally observe higher coverage for their genomes- it's a good way to tell what the composition is of your community/sample.

It's also a great way to separate bins out!

Here's what the coverage bar looks like:

<img src="https://github.com/jwestrob/jwestrob.github.io/blob/master/assets/img/coverage_notzoomed.png" width=250>

You'll notice it's pretty hard to see any pattern that might correspond to an individual genome, since most contigs have pretty low coverage. (That's normal!) To get around this, we use the lower of the two bars to zoom in, like so:

<img src="https://github.com/jwestrob/jwestrob.github.io/blob/master/assets/img/coverage_zoomed.png" width=250>
