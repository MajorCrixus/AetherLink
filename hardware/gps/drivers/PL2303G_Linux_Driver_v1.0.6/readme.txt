Linux Kernel 5.5 and above already includes built-in drivers for PL2303G Chip.

If you's Linux kernel is v2.6.15 ~v5.4,  
Please update the PL2303G Linux driver in the following way.

1. terminal			// open terminal AP. S1.png
2. uname -r			// found out the nearest Linux kernel version first , S2.png
3. make all			// make new driver, if you have meet error message during make kernel driver, please send email to us. , S3.png
4. sudo cp pl2303.ko /lib/modules/$(uname -r)/kernel/drivers/usb/serial
				// copy new driver to kernel. S4.png
5. sudo gedit /etc/modules	// edit modules ,  S5.png
6. pl2303			// add pl2303, save, close modules   , S6.png
7. reboot			// reboot OS , S7.png
8. plug in new cable, and then enjoy!

If you have any questions about the above steps, please send email to us. 

Email: sales@prolific.com.tw
