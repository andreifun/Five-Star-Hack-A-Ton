import subprocess
import sys
import os

try:
    import googlemaps
except ImportError:
    print("Installing googlemaps library...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "googlemaps"])
    import googlemaps


def get_maps_url(query: str) -> str:
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not api_key:
        print(
            "\n[ERROR] GOOGLE_MAPS_API_KEY environment variable is not set.\n"
            "\nTo fix this:\n"
            "  1. Go to https://console.cloud.google.com/ and create/select a project.\n"
            "  2. Enable the 'Places API' under APIs & Services.\n"
            "  3. Create an API key under APIs & Services > Credentials.\n"
            "  4. Set the variable before running this script:\n"
            "       Linux/macOS:  export GOOGLE_MAPS_API_KEY=your_key_here\n"
            "       Windows CMD:  set GOOGLE_MAPS_API_KEY=your_key_here\n"
        )
        sys.exit(1)

    client = googlemaps.Client(key=api_key)

    print(f"\nSearching Google Maps for: \"{query}\"...")
    response = client.places(query=query)

    results = response.get("results", [])
    if not results:
        print("No results found.")
        sys.exit(1)

    results = results[:3]

    if len(results) == 1:
        chosen = results[0]
    else:
        print("\nFound the following places:\n")
        for i, place in enumerate(results, 1):
            name = place.get("name", "Unknown")
            address = place.get("formatted_address", "No address")
            print(f"  {i}. {name}")
            print(f"     {address}")
        print()

        while True:
            raw = input(f"Select a result [1-{len(results)}]: ").strip()
            if raw.isdigit() and 1 <= int(raw) <= len(results):
                chosen = results[int(raw) - 1]
                break
            print(f"  Please enter a number between 1 and {len(results)}.")

    place_id = chosen.get("place_id")
    if not place_id:
        print("Could not retrieve place_id for the selected result.")
        sys.exit(1)

    url = f"https://www.google.com/maps/place/?q=place_id:{place_id}"

    print(f"\nBusiness : {chosen.get('name')}")
    print(f"Address  : {chosen.get('formatted_address')}")
    print(f"Place ID : {place_id}")
    print(f"\nGoogle Maps URL:\n  {url}\n")

    return url


def main() -> str:
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    else:
        query = input("Enter business name to search: ").strip()
        if not query:
            print("No query provided.")
            sys.exit(1)

    return get_maps_url(query)


if __name__ == "__main__":
    main()
