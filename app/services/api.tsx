const BASE_URL = "https://api.atlasacademy.io"

function capitalizeFirstLetter(val: string) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

export const getServantsHomePage = async () => {
    const response = await fetch('https://api.atlasacademy.io/export/NA/nice_servant.json');

    if(!response.ok){
        throw new Error("Failed to fetch servants.")
    }
    const data = await response.json()

    return data
        .filter((servant: any) => {
            return servant.extraAssets?.faces?.ascension?.["1"];
        })
        .map((servant: any) => ({
            id: servant.id,
            name: servant.name,
            className: capitalizeFirstLetter(servant.className),
            rarity: servant.rarity,
            portrait: servant.extraAssets.faces.ascension["1"]
        }));
}

export const getServantData = async(svt_id : number) => {
    const response = await fetch(`https://api.atlasacademy.io/nice/NA/svt/${svt_id}`)
    const data = await response.json()

    return data.map((servant: any) => ({
        id: servant.id,
        name: servant.name,
        className: servant.className,
        rarity: servant.rarity,
        portraits: servant.extraAssets.faces.ascension
        
     }));
}
    
