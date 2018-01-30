#!/bin/bash
JBROWSE=${1:-"/var/www/html/jbrowse/latest"}
JBROWSE_CONF="${JBROWSE}/jbrowse.conf"
cp -R ./Facebase "${JBROWSE}/plugins"
if [ -f "${JBROWSE_CONF}" ]
then
    mv "${JBROWSE_CONF}" "${JBROWSE_CONF}-$(date +%Y%m%d-%H%M%S)"
fi
cp ./jbrowse.conf "${JBROWSE_CONF}"

