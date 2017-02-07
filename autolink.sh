perl -p -i.bak -e 's/: (https?:[\S]+)/: [\1](\1)/g' index.md

