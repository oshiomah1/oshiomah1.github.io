---
layout: post
title:  "Week 2 Walkthrough- Read Quality and Trimming"
date:   2023-01-24
excerpt: "Read Trimming and Quality Control!"
project: "ESPM_112L"
tag:
- Read Quality
comments: true
---



<h1>Hello and welcome to week 2 of ESPM 112L-</h1>

<h1>Metagenomic Data Analysis Lab!</h1>

* TOC
{:toc}

### Tasks for Today

Lab today will hopefully be easy on the technical front, and more about interpreting raw sequence data (what you receive back from a sequencing facility after sending them your extracted DNA).

To get your points for the day, please provide the following in the submission assignment on bCourses:

- The HTML output of FastQC run before and after trimming
- Answers to questions (located at the end of the walkthrough)
- Names of your group members

### 1. Connecting to the class server

The class server is a computer we're using to host your data and perform computational tasks this semester. Each of you will register for an account today, and learn how to access it. Physically, it exists just off campus in the UC Berkeley data center on Hearst; luckily for you, we can access it from anywhere. Let's go over how.

#### SSH

SSH stands for 'Secure Shell'. Remember how the terminal is also called a shell? We're just going to be connecting to a new terminal session on the class server over the internet. This is one of two most important commands to remember for this class, so write it down somewhere and remember you can always come back here to see it again.

`ssh username@class.ggkbase.berkeley.edu`

Pretty simple! I will be giving out usernames in class, as well as telling you the default password. (Information security 101: Don't give away passwords willy-nilly.) Once you've connected successfully, you're going to need to change that default password.

#### Changing the password

The command to change your password is `passwd`. Type this, and you will see a prompt asking for your current password. Enter it, then enter the new password- then you're done!

#### Samples

Each group will be assigned a sample today, and starting this week you'll work with that sample. These samples are big, though, and so we're going to have to take a couple precautions to avoid copying them and using up a ton of disk space!

### 2. Getting your reads

Make a folder in your home directory (use the `mkdir` command) called `raw.d`. This is how we designate the folders containing our raw sequencing data in the Banfield lab standard workflow. Then `cd` into that directory. Now let's fetch your sequence files.

The reads are located at `/class_data/reads/`. I've sent out the full path to your reads for each group on Slack. Because these are large files, we can't just copy them over to all your home directories- that would instantly use tons of disk space! Instead we're going to make what are called 'symbolic links' of your read files. They look, act and are identical in every way to the original files; luckily, though, they don't take up any space on the hard drive! They'll show up as light blue instead of white like other normal files.

Here's how you make a symbolic link to your reads- remember you'll need to do this for both your forward and reverse reads.

```
ln -s [EXAMPLE FILENAME] .
```

This creates a link - you can modify the file as normal, but it won't take up any extra disk space and will let you modify it without providing the full PATH. Otherwise, you'd have to type `/class_data/reads/[SAMPLE NAME]/` every time you wanted to access your files. (Which you can still do! I guess. Live your best life.)

Here I'll use an example set of reads. Make sure to use your own set of reads which I provided to your group on Slack. Here's an example of what to do:
```
cd ~
mkdir raw.d
cd raw.d
#Remember to use reads from your sapmle instead of these example files!
ln -s /class_data/reads/JS_WN1_S130/JS_WN1_S130.1.fastq.gz .
ln -s /class_data/reads/JS_WN1_S130/JS_WN1_S130.2.fastq.gz .
```

Now that you've got the data loaded, let's run our QC program, fastqc! I highly recommend one person per group do this, since it can take quite a while; this way you can get started on the rest of the lab while it's running. ()

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

Read the help menu carefully. FastQC will analyze both your forward and reverse reads at once, so make sure to provide them both!

You have the option of putting the output in a directory (by providing a value for the `-o` flag), which is tidy, or just having FastQC output everything in your current directory. I recommend making a directory to put the output in, like so:

```
mkdir fastQC_output
fastqc -o fastQC_output [forward_reads] [reverse_reads]
```

This took about 15 minutes running it on the data I use for my research- I would say you should expect it to take about as long on your samples.

Once this is done, you're going to have an output .html file (either in your current directory or in the output directory you specified with `-o`). We're going to want to download it! This file is an .html file, so you want to open it in a web browser- Firefox, Chrome, Safari, Internet Explorer 6, Netscape, whatever you want.

### How to Download Files From The Cluster (IMPORTANT)

This is a very important skill, and one that will come up many times throughout the semester. Historically, it's been a bit tricky, so I want to devote some time to it.

You have two options. The easiest of these by far if you're on Mac or Windows is to use <a href="https://cyberduck.io/">Cyberduck</a>:

 - Download using a GUI program like <a href="https://winscp.net/eng/download.php">WinSCP</a> for Windows, <a href="https://cyberduck.io/">Cyberduck</a> for Windows or Mac OSX, or Filezilla, I guess, if you're using Linux. (Instructions on how to use Filezilla for this purpose are <a href="https://stackoverflow.com/questions/299412/is-there-any-winscp-equivalent-for-linux">here</a> although I really recommend you just use SCP if you're on linux.)

 GUI-based SCP applications are pretty straightforward. If you have questions about them ask me in class or on slack.

 - Download with SCP. Here's an example of how to do that (I also will give a demonstration in class):

  - Get the full path to the file you want to download and copy it!

   ```
   realpath example_fastqc_output.html
   # OUTPUT: /home/jwestrob/fastqc/example_fastqc_output.html
   # Copy that! ^
   ```

  - Open a terminal on your computer (NOT the class server- you can leave that one open or close it) and navigate to the folder you want to download to.

  ```
  cd ~/Downloads/
  scp jwestrob@class.ggkbase.berkeley.edu:/home/jwestrob/fastqc/example_fastqc_output.html .
  # In Bash, "." just means "here", i.e. your current location.                            
  ```


### Trimming with Sickle

Next we're going to use Sickle to trim your reads with `sickle`. Try running `sickle pe -h` for help (the `pe` stands for `paired-end`). This yields the following help information:

```
If you have separate files for forward and reverse reads:
Usage: sickle pe [options] -f <paired-end forward fastq file> -r <paired-end reverse fastq file> -t <quality type> -o <trimmed PE forward file> -p <trimmed PE reverse file> -s <trimmed singles file>

If you have one file with interleaved forward and reverse reads:
Usage: sickle pe [options] -c <interleaved input file> -t <quality type> -m <interleaved trimmed paired-end output> -s <trimmed singles file>

If you have one file with interleaved reads as input and you want ONLY one interleaved file as output:
Usage: sickle pe [options] -c <interleaved input file> -t <quality type> -M <interleaved trimmed output>

Options:
Paired-end separated reads
--------------------------
-f, --pe-file1, Input paired-end forward fastq file (Input files must have same number of records)
-r, --pe-file2, Input paired-end reverse fastq file
-o, --output-pe1, Output trimmed forward fastq file
-p, --output-pe2, Output trimmed reverse fastq file. Must use -s option.

Paired-end interleaved reads
----------------------------
-c, --pe-combo, Combined (interleaved) input paired-end fastq
-m, --output-combo, Output combined (interleaved) paired-end fastq file. Must use -s option.
-M, --output-combo-all, Output combined (interleaved) paired-end fastq file with any discarded read written to output file as a single N. Cannot be used with the -s option.
```

There's more, but I'll let you read it on your terminal instead of putting it here.

So remember, you have your forward and reverse reads, so you'll be using the first option-

```
If you have separate files for forward and reverse reads:
Usage: sickle pe [options] -f <paired-end forward fastq file> -r <paired-end reverse fastq file> -t <quality type> -o <trimmed PE forward file> -p <trimmed PE reverse file> -s <trimmed singles file>
```

Here's an example, again using the example dataset. Remember not to copy paste this, because your sample name will be different!

```
sickle pe -t sanger -f JS_WN1_S130.1.fastq.gz -r JS_WN1_S130.2.fastq.gz -o JS_WN1_S130.trimmed.1.fastq.gz -p JS_WN1_S130.trimmed.2.fastq.gz -s JS_WN1_S130.trimmed.single.fastq.gz
```

Notice the flag `-t sanger`; this indicates the way the per-base quality scores are formatted. This should take a couple more minutes. Also, make sure the output filenames (`-o`, `-p`, and `-s`) are different than the input filenames, so you don't accidentally overwrite your files. (If you do, just let me know and I'll get you the original data back.)

This step should take about 5 minutes or so. Don't worry if it goes longer. (Every sample is a different size.)

### Final step: FastQC on the trimmed reads

So now that you've got trimmed reads, we want to get FastQC results that show how much our quality scores have improved. Run FastQC again, this time using only the trimmed reads.

I recommend making another directory for the trimmed FastQC output, like so:

```
mkdir fastQC_trimmed_output
fastqc -o fastQC_trimmed_output [trimmed_forward_reads] [trimmed_reverse_reads] [trimmed_singleton_reads]
```

Note how I included the singleton reads here (i.e., reads without a mate pair). You don't have to do this, but I recommend it!

Now, as you did before, download the FastQC output and open it on your computer.


# Questions

1. Do you see anything worrying in terms of quality scores in your untrimmed reads?

2. What are the noticeable differences in the FastQC output between your trimmed and untrimmed reads?

3. Briefly describe the pros and cons of short read vs. long read sequencing, and a project that would be appropriate (or inappropriate) to use them for.

4. Based on the average read length and number of reads for one of your samples, answer the following question: What % of the community does a microbe with a 3,000,000 bp genome need to be at in order to be recovered at 10x coverage?
