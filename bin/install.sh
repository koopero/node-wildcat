#!/bin/bash
echo "# This script should install Wildcat dependencies. "
echo "# After inspecting it, run:"
echo "#"
echo "#     wildcat-install | sudo /bin/sh"
echo "#"


#Mac
EASY="curl wget"

if [ `uname` == "Darwin" ]; then
	if [`which port`]; then
		echo "# Trying to use MacPorts"
	elif [`which brew`]; then
		#Brew
		echo "# Isn't Homebrew awesome?"
		INSTALL="brew install"
		EXIFTOOL="exiftool"
		MAGICK="libtiff ufraw imagemagick --libtiff"
		FFMPEG="ffmpeg qtfaststart"
	fi

elif [ `uname` == "Linux" ]; then

	if [ -f /etc/redhat-release ]; then
		# EL6
		echo "# Install EPEL for EL6"
		echo "rpm -Uvh http://download.fedoraproject.org/pub/epel/6/i386/epel-release-6-8.noarch.rpm"

		echo "# Install RPM fusion for EL6"
		echo "yum -y localinstall --nogpgcheck http://download1.rpmfusion.org/free/el/updates/6/i386/rpmfusion-free-release-6-1.noarch.rpm http://download1.rpmfusion.org/nonfree/el/updates/6/i386/rpmfusion-nonfree-release-6-1.noarch.rpm"

		INSTALL="yum -y install"
		EXIFTOOL="perl-Image-ExifTool"
		MAGICK="ImageMagick"
		FFMPEG="ffmpeg"

	elif grep -s -q "Debian" /etc/os-release; then
		#Debian
		echo "# Updating Debian"
		echo "apt-get -y update"
		INSTALL="apt-get -y install"
		EXIFTOOL="libimage-exiftool-perl"
		FFMPEG="ffmpeg"
		MAGICK="ufraw imagemagick"		

	else
		echo "# Linux release not supported"
		exit 1





		#Ubuntu
		UPDATE="apt-get update"
		INSTALL="apt-get -y install"
		EXIFTOOL="libimage-exiftool-perl"
		MAGICK="ufraw imagemagick"

		# Gentoo

		UPDATE="emerge --sync"
		
		# Silly thing builds everything from source, might take a while.
		INSTALL="emerge"
		# Fuck, since need to include all the useful prerequisites for
		# ffmpeg and Magick. That's a pain that ain't worth it.
		MAGICK="ufraw imagemagick"
		EXIFTOOL="exiftool"
		FFMPEG="ffmpeg"
	fi

fi



#EL6

	





PACKAGES="$EASY $EXIFTOOL $MAGICK $FFMPEG "
CMD="$INSTALL $PACKAGES"

echo $CMD