#!/bin/bash
#
# install_deps.sh
# 在线安装全部依赖包及其所有依赖（非离线模式）
#
# 用法（在 WSL 中执行）:
#   bash install_deps.sh
#
# 注意：从 Windows 复制过来的脚本可能带 \r 换行符，
#       若执行报错请先运行：  sed -i 's/\r$//' install_deps.sh
#
# 说明：
#   - apt-get 与 apt 等价，脚本里用 apt-get（更适合脚本，不会出 CLI 警告）
#   - -y = 自动确认 yes，是整条命令的全局开关，对所有包生效，位置随意
#

set -euo pipefail

echo "============================================"
echo " [1/4] 清理 apt 缓存"
echo "============================================"
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/*

echo "============================================"
echo " [2/4] 更新 apt 软件包索引"
echo "============================================"
sudo apt-get update

echo "============================================"
echo " [3/4] 安装 apt 软件包（apt 会自动解析并安装全部依赖）"
echo "============================================"
sudo apt-get install -y \
    libssl-dev \
    bison \
    flex \
    autoconf \
    automake \
    libtool \
    device-tree-compiler \
    pkg-config \
    m4 \
    openjdk-11-jdk \
    mtd-utils \
    u-boot-tools \
    python3-pip \
    cmake \
    unzip \
    zip \
    locales \
    language-pack-en-base \
    bc \
    libelf-dev \
    fakeroot \
    squashfs-tools \
    ccache

echo "============================================"
echo " [4/4] 安装 pip 软件包（pip 会自动解析并安装全部依赖）"
echo "============================================"

# Ubuntu 23.04+ 启用了 PEP 668，默认禁止系统级 pip install；
# 检测到 EXTERNALLY-MANAGED 标记时自动加 --break-system-packages。
EXTERNALLY_MANAGED="$(python3 -c 'import os,sysconfig; print(os.path.exists(os.path.join(sysconfig.get_path("stdlib"),"EXTERNALLY-MANAGED")))' 2>/dev/null || echo False)"
PIP_EXTRA_ARGS=""
if [ "$EXTERNALLY_MANAGED" = "True" ]; then
    echo "检测到 externally-managed-environment，将使用 --break-system-packages"
    PIP_EXTRA_ARGS="--break-system-packages"
fi

pip3 install $PIP_EXTRA_ARGS \
    prettytable \
    pyelftools \
    pycryptodome \
    gmssl

echo "============================================"
echo " ✅ 全部依赖安装完成！"
echo "============================================"
