document.addEventListener('DOMContentLoaded', function() {
  const pageTitle = document.getElementById('pageTitle');
  pageTitle.addEventListener('click', function() {
    window.location.href = '/archive';
  });

  const uploadForm = document.getElementById('uploadForm');
  const docxFileInput = document.getElementById('docxFile');
  const documentList = document.getElementById('documentList');

  uploadForm.addEventListener('submit', async function(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append('docxFile', docxFileInput.files[0]);
    const response = await fetch('/document-management/upload', { method: 'POST', body: formData });
    if (response.ok) {
      loadDocuments();
    } else {
      alert('Ошибка при загрузке файла');
    }
  });

  window.loadDocuments = async function() { // Сделать функцию глобальной
    const response = await fetch('/document-management/documents');
    if (response.ok) {
      const documents = await response.json();
      documentList.innerHTML = '';
      documents.forEach(doc => {
        const docCard = document.createElement('div');
        docCard.className = 'document-card';
        docCard.innerHTML = `
          <p class="document-filename">${doc.filename}</p>
          <button class="details-button" onclick="showDocumentDetails(${doc.id})">Подробнее</button>
          <button class="archive-button" onclick="archiveDocument(${doc.id})">В Архив</button>
        `;
        documentList.appendChild(docCard);
      });
    } else {
      alert('Ошибка при загрузке списка документов');
    }
  }

  loadDocuments();
});

async function archiveDocument(id) {
  const response = await fetch(`/document-management/archive/${id}`, { method: 'POST' });
  if (response.ok) {
    loadDocuments(); // Вызов глобальной функции
  } else {
    alert('Ошибка при перемещении документа в архив');
  }
}

async function showDocumentDetails(id) {
  const response = await fetch(`/document-management/documents/${id}`);
  if (response.ok) {
    const documentData = await response.json();
    document.getElementById('documentTitle').textContent = documentData.title;
    document.getElementById('documentProperties').innerHTML = formatMetadata(JSON.parse(documentData.properties));
    document.getElementById('documentMetadata').innerHTML = formatMetadata(JSON.parse(documentData.metadata));
    document.getElementById('documentContent').textContent = documentData.content;
    document.getElementById('documentModal').style.display = 'block';
  } else {
    alert('Ошибка при получении информации о документе');
  }
}

function formatMetadata(metadata) {
  return Object.entries(metadata).map(([key, value]) => {
    if (Array.isArray(value)) {
      return `<li>${key}: [${value.join(', ')}]</li>`;
    }
    return `<li>${key}: ${value}</li>`;
  }).join('');
}

function closeDocumentModal() {
  document.getElementById('documentModal').style.display = 'none';
}
