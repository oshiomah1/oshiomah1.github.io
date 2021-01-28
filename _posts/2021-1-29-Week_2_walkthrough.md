---
layout: post
title:  "Week 2 Walkthrough- Intro to Bash"
date:   2020-02-29
excerpt: "Introducing the Command Line!"
project: "ESPM_112L"
tag:
- test
comments: true
---



<h1>Hello and welcome to week 2 of ESPM 112L-</h1>

<h1>Metagenomic Data Analysis Lab!</h1>

* TOC
{:toc}

`Ctrl+Alt+t`

### Tasks for Today

Lab today will hopefully be easy on the technical front, and more about interpreting raw sequence data (what you receive back from a sequencing facility after sending them your extracted DNA).

To get your points for the day, please provide the following:

- The PATH (use `realpath [FILENAME]`) to the output of `fastqc`
- The PATH to your sickle-trimmed reads


### 1. Getting Connected Once Again

Time to get back onto the class server! Working locally won't work for today's lab since we need to use data that's stored on the class server.

Get your student ID number and password out, and connect to the cluster however you did last week:

`ssh studentX@class.ggkbase.berkeley.edu`

Each group will be assigned a sample today, and starting this week you'll work with that sample. These samples are big, though, and so we're going to have to take a couple precautions to avoid copying them and using up a ton of disk space!

### 2. Getting your reads

Make a folder in your home directory (use the `mkdir` command) called `raw.d`. This is how we designate the folders containing our raw sequencing data in the Banfield lab standard workflow. Then `cd` into that directory. Now let's fetch your sequence files.

The reads are located at
# INSERT READ PATH HERE
. Because these are large files, we can't just copy them over to all your home directories- that would instantly use tons of disk space! Instead we're going to make what are called 'symbolic links' of your read files. They look, act and are identical in every way to the original files; luckily, though, they don't take up any space on the hard drive! They'll show up as light blue instead of white like other normal files.

Here's how you make a symbolic link to your reads- remember you'll need to do this for both your forward and reverse reads.

`ln -s [READ PATH] .`

Here's an example of what to do:
```
cd ~
mkdir raw.d
cd raw.d
ln -s [example_forward_reads] .
ln-s [example_reverse_reads] .
```

Now that you've got the data loaded, let's run our QC program, fastqc! I highly recommend one person per group do this, since it can take quite a while; this way you can get started on the rest of the lab while it's running.

### Running FastQC

FastQC is a program to assess the quality of raw sequencing reads. We're going to use this before and after trimming your reads to highlight the difference trimming makes.

FastQC is loaded already onto the cluster, so you all have access. Try running the help menu with `fastqc -h`. The output should look like this:

```
FastQC - A high throughput sequence QC analysis tool

SYNOPSIS

fastqc seqfile1 seqfile2 .. seqfileN

fastqc [-o output dir] [--(no)extract] [-f fastq|bam|sam]
[-c contaminant file] seqfile1 .. seqfileN

DESCRIPTION

FastQC reads a set of sequence files and produces from each one a quality
control report consisting of a number of different modules, each one of
which will help to identify a different potential type of problem in your
data.

If no files to process are specified on the command line then the program
will start as an interactive graphical application.  If files are provided
on the command line then the program will run with no user interaction
required.  In this mode it is suitable for inclusion into a standardised
analysis pipeline.

The options for the program as as follows:

-h --help       Print this help file and exit

-v --version    Print the version of the program and exit

-o --outdir     Create all output files in the specified output directory.
        Please note that this directory must exist as the program
        will not create it.  If this option is not set then the
        output file for each sequence file is created in the same
        directory as the sequence file which was processed.
```


{% capture images %}
  https://1.bp.blogspot.com/-y_Qcr6C4aTQ/UB5xcCxM3ZI/AAAAAAAABSk/29C-JeH68Nk/s1600/Pretty+Terminal+Mac.png
{% endcapture %}
{% include gallery images=images caption="Example Terminal with Color Formatting" cols=1 %}
