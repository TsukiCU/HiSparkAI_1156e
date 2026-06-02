VERSION_CHOOSE=$1

if [ $VERSION_CHOOSE = Default ]
then
    HITL=Result/HiIDE
    rm resources/chips/*Brandy.json
else
	HITL=Result/HiIDE_Brandy
    cd resources/chips && ls|grep -v "Brandy.json\|chiplist.json"|xargs rm -rf && rm chiplist.json && mv chiplist_Brandy.json chiplist.json && cd ../..
fi

mkdir -p $HITL

artget pull -ap ./resources "HiIDE V100R001C00B060" -ru inner -rp Simulator.zip

yarn config set strict-ssl false && yarn config set disable-self-update-check true && yarn && yarn add @vscode/vsce

yarn pre-launch && yarn run vscode:package && mv ./hisparkprojectwizard-*.vsix $HITL
