async function loadDocuments() {
	await loadDocumentsByStatus("Ожидание", "pendingDocuments");
	await loadDocumentsByStatus("Подписанный", "approvedDocuments");
	await loadDocumentsByStatus("Отклонённый", "rejectedDocuments");
}

document.addEventListener("DOMContentLoaded", function () {
	const pageTitle = document.getElementById("pageTitle");
	pageTitle.addEventListener("click", function () {
		window.location.href = "/archive";
	});

	const uploadForm = document.getElementById("uploadForm");
	const docxFileInput = document.createElement("input");
	docxFileInput.type = "file";
	docxFileInput.style.display = "none";
	docxFileInput.name = "docxFile";
	docxFileInput.required = true;
	uploadForm.appendChild(docxFileInput);

	const dropZone = document.getElementById("dropZone");
	dropZone.addEventListener("dragover", (event) => {
		event.preventDefault();
		dropZone.classList.add("dragover");
	});
	dropZone.addEventListener("dragleave", () => {
		dropZone.classList.remove("dragover");
	});
	dropZone.addEventListener("drop", (event) => {
		event.preventDefault();
		dropZone.classList.remove("dragover");
		const files = event.dataTransfer.files;
		if (files.length > 0) {
			handleFile(files[0]);
		}
	});
	dropZone.addEventListener("click", () => {
		docxFileInput.click();
	});
	docxFileInput.addEventListener("change", () => {
		if (docxFileInput.files.length > 0) {
			handleFile(docxFileInput.files[0]);
		} else {
			dropZone.textContent =
				"Перетащите файлы .DOCX сюда или нажмите для выбора";
		}
	});

	uploadForm.addEventListener("submit", async function (event) {
		event.preventDefault();
		const formData = new FormData();
		if (docxFileInput.files.length > 0) {
			formData.append("docxFile", docxFileInput.files[0]);
			const response = await fetch("/document-management/upload", {
				method: "POST",
				body: formData,
			});
			if (response.ok) {
				loadDocuments();
				docxFileInput.value = "";
				dropZone.textContent =
					"Перетащите файлы .DOCX сюда или нажмите для выбора";
			} else {
				alert("Ошибка при загрузке файла");
			}
		} else {
			alert("Пожалуйста, выберите файл для загрузки");
		}
	});

	function handleFile(file) {
		if (file.name.endsWith(".docx")) {
			dropZone.textContent = file.name;
		} else {
			showErrorBanner();
			docxFileInput.value = "";
			dropZone.textContent =
				"Перетащите файлы .DOCX сюда или нажмите для выбора";
		}
	}

	function showErrorBanner() {
		const banner = document.getElementById("errorBanner");
		banner.style.display = "block";
		banner.style.opacity = "1";
		setTimeout(() => {
			banner.style.opacity = "0";
			setTimeout(() => {
				banner.style.display = "none";
			}, 1000); // Время затухания должно совпадать с transition в CSS
		}, 2000); // Время показа баннера перед началом затухания
	}

	loadDocuments();
});

async function archiveDocument(id) {
	const response = await fetch(`/document-management/archive/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при перемещении документа в архив");
	}
}

async function showDocumentDetails(id) {
	const response = await fetch(`/document-management/documents/${id}`);
	if (response.ok) {
		const documentData = await response.json();
		document.getElementById("documentTitle").textContent =
			documentData.title;
		document.getElementById("documentProperties").innerHTML =
			formatMetadata(JSON.parse(documentData.properties));
		document.getElementById("documentMetadata").innerHTML = formatMetadata(
			JSON.parse(documentData.metadata),
		);
		document.getElementById("documentContent").textContent =
			documentData.content;
		document.getElementById("documentModal").style.display = "block";
	} else {
		alert("Ошибка при получении информации о документе");
	}
}

function formatMetadata(metadata) {
	return Object.entries(metadata)
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				return `<li>${key}: [${value.join(", ")}]</li>`;
			}
			return `<li>${key}: ${value}</li>`;
		})
		.join("");
}

function closeDocumentModal() {
	document.getElementById("documentModal").style.display = "none";
}

document.addEventListener("DOMContentLoaded", function () {
	loadDocuments();
});

async function loadDocumentsByStatus(status, containerId) {
	const response = await fetch(`/document-management/documents/status/${status}`);
	if (response.ok) {
		const documents = await response.json();
		const container = document.getElementById(containerId);
		container.innerHTML = "";
		documents.forEach((doc) => {
			const docCard = createDocumentCard(doc);
			container.appendChild(docCard);
		});
	} else {
		alert("Ошибка при загрузке документов");
	}
}

async function signDocument(id) {
	const response = await fetch(`/document-management/sign/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при подписании документа");
	}
}

async function rejectDocument(id) {
	const response = await fetch(`/document-management/reject/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при отклонении документа");
	}
}

async function revokeDocument(id) {
	const response = await fetch(`/document-management/revoke/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при отзыве документа");
	}
}

async function reviewDocument(id) {
	const response = await fetch(`/document-management/review/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при пересмотре документа");
	}
}

async function destroyDocument(id) {
	const response = await fetch(`/document-management/destroy/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при уничтожении документа");
	}
}

async function archiveDocument(id) {
	const response = await fetch(`/document-management/archive/${id}`, {
		method: "POST",
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при перемещении документа в архив");
	}
}

function createDocumentCard(doc) {
    const docCard = document.createElement("div");
    docCard.className = "document-card";
    docCard.innerHTML = `
        <p class="document-filename">${doc.filename}</p>
    `;

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "button-container";

    if (doc.status === "Ожидание") {
        buttonContainer.innerHTML += `
            <button class="sign-button" onclick="signDocument(${doc.id})">Подписать</button>
            <button class="reject-button" onclick="rejectDocument(${doc.id})">Отклонить</button>
            <button class="details-button" onclick="showDocumentDetails(${doc.id})">Подробнее</button>
        `;
    } else if (doc.status === "Подписанный") {
        buttonContainer.innerHTML += `
            <button class="approve-button" onclick="archiveDocument(${doc.id})">Утвердить</button>
            <button class="revoke-button" onclick="revokeDocument(${doc.id})">Отозвать</button>
            <button class="details-button" onclick="showDocumentDetails(${doc.id})">Подробнее</button>
        `;
    } else if (doc.status === "Отклонённый") {
        buttonContainer.innerHTML += `
            <button class="review-button" onclick="reviewDocument(${doc.id})">Пересмотреть</button>
            <button class="details-button" onclick="showDocumentDetails(${doc.id})">Подробнее</button>
            <button class="archive-button" onclick="archiveDocument(${doc.id})">В Архив</button>
            <button class="destroy-button" onclick="destroyDocument(${doc.id})">Уничтожить</button>
        `;
    }

    docCard.appendChild(buttonContainer);
    return docCard;
}


async function updateDocumentStatus(id, newStatus) {
	const response = await fetch(`/document-management/update-status/${id}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ status: newStatus }),
	});
	if (response.ok) {
		loadDocuments();
	} else {
		alert("Ошибка при обновлении статуса");
	}
}
