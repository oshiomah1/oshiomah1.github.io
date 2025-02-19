import React, { useRef } from 'react';
import styles from './Contact.module.css';
import emailjs from '@emailjs/browser';

const Contact = () => {
  const form = useRef();
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h2 className={styles.title}>Contact Me</h2>
        <div className={styles.textContent}>
          <p>
            I'm always interested in collaborating on research projects, discussing environmental
            science, or exploring new opportunities in data analysis and ecological studies.
          </p>
          <div className={styles.contactInfo}>
            <h3>Get in Touch</h3>
            <p>Email: jacobwestroberts@gmail.com</p>
            <p>Location: Foster City, CA</p>
          </div>
          <div className={styles.contactForm}>
            <h3>Send a Message</h3>
            <form ref={form} onSubmit={(e) => {
              e.preventDefault();
              emailjs.sendForm('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', form.current, 'YOUR_PUBLIC_KEY')
                .then((result) => {
                    alert('Message sent successfully!');
                    form.current.reset();
                }, (error) => {
                    alert('Failed to send message. Please try again.');
                    console.error('Error:', error);
                });
            }}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Name:</label>
                <input type="text" id="name" name="name" required />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email:</label>
                <input type="email" id="email" name="email" required />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="message">Message:</label>
                <textarea id="message" name="message" rows="4" required></textarea>
              </div>
              <button type="submit" className={styles.submitButton}>Send Message</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;