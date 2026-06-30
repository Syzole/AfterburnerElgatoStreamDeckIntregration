import ctypes
from ctypes import wintypes

kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

FILE_MAP_READ = 0x0004

# -----------------------------------------------------------------------------
# WinAPI
# -----------------------------------------------------------------------------

OpenFileMapping = kernel32.OpenFileMappingW
OpenFileMapping.argtypes = [
    wintypes.DWORD,
    wintypes.BOOL,
    wintypes.LPCWSTR,
]
OpenFileMapping.restype = wintypes.HANDLE

MapViewOfFile = kernel32.MapViewOfFile
MapViewOfFile.argtypes = [
    wintypes.HANDLE,
    wintypes.DWORD,
    wintypes.DWORD,
    wintypes.DWORD,
    ctypes.c_size_t,
]
MapViewOfFile.restype = ctypes.c_void_p

UnmapViewOfFile = kernel32.UnmapViewOfFile
UnmapViewOfFile.argtypes = [ctypes.c_void_p]
UnmapViewOfFile.restype = wintypes.BOOL

CloseHandle = kernel32.CloseHandle
CloseHandle.argtypes = [wintypes.HANDLE]
CloseHandle.restype = wintypes.BOOL

# -----------------------------------------------------------------------------
# Structures
# -----------------------------------------------------------------------------

SIGNATURE = 0x4D41484D


class MAHM_SHARED_MEMORY_HEADER(ctypes.Structure):
    _fields_ = [
        ("dwSignature", ctypes.c_uint32),
        ("dwVersion", ctypes.c_uint32),
        ("dwHeaderSize", ctypes.c_uint32),
        ("dwNumEntries", ctypes.c_uint32),
        ("dwEntrySize", ctypes.c_uint32),
        ("time", ctypes.c_int32),
        ("_padding", ctypes.c_int32),
        ("dwNumGpuEntries", ctypes.c_uint32),
        ("dwGpuEntrySize", ctypes.c_uint32),
    ]


class MAHM_SHARED_MEMORY_ENTRY(ctypes.Structure):
    _fields_ = [
        ("szSrcName", ctypes.c_char * 260),
        ("szSrcUnits", ctypes.c_char * 260),
        ("szLocalizedSrcName", ctypes.c_char * 260),
        ("szLocalizedSrcUnits", ctypes.c_char * 260),
        ("szRecommendedFormat", ctypes.c_char * 260),
        ("data", ctypes.c_float),
        ("minLimit", ctypes.c_float),
        ("maxLimit", ctypes.c_float),
        ("dwFlags", ctypes.c_uint32),
        ("dwGpu", ctypes.c_uint32),
        ("dwSrcId", ctypes.c_uint32),
    ]


assert ctypes.sizeof(MAHM_SHARED_MEMORY_ENTRY) == 1324

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def cstring(buf):
    return bytes(buf).split(b"\0", 1)[0].decode("utf-8", errors="ignore")


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------


def main():
    hMap = OpenFileMapping(FILE_MAP_READ, False, "MAHMSharedMemory")

    if not hMap:
        print(ctypes.WinError(ctypes.get_last_error()))
        return

    view = MapViewOfFile(hMap, FILE_MAP_READ, 0, 0, 0)

    if not view:
        print(ctypes.WinError(ctypes.get_last_error()))
        CloseHandle(hMap)
        return

    try:
        header = ctypes.cast(view, ctypes.POINTER(MAHM_SHARED_MEMORY_HEADER)).contents

        if header.dwSignature != SIGNATURE:
            print("Invalid MAHM signature.")
            return

        print("Header")
        print("-" * 60)
        print("Version      :", header.dwVersion)
        print("Header Size  :", header.dwHeaderSize)
        print("Entry Size   :", header.dwEntrySize)
        print("Entry Count  :", header.dwNumEntries)
        print()

        base = view + header.dwHeaderSize

        print("Sensors")
        print("-" * 60)

        for i in range(header.dwNumEntries):
            addr = base + i * header.dwEntrySize

            entry = ctypes.cast(addr, ctypes.POINTER(MAHM_SHARED_MEMORY_ENTRY)).contents

            name = entry.szSrcName.decode(errors="ignore").rstrip("\0")
            units = entry.szSrcUnits.decode(errors="ignore").rstrip("\0")

            print(f"{i:02d} | {name:30} {entry.data:10.2f} {units}")

    finally:
        UnmapViewOfFile(view)
        CloseHandle(hMap)

    input("Press Enter...")


if __name__ == "__main__":
    main()
